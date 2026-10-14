from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket
from pydantic import BaseModel, Field

from utils.jwt_auth import get_current_user
from utils.websocket_manager import ws_manager, notification_websocket_endpoint
from db.notifications_db import (
    get_user_notifications,
    mark_notification_read,
    mark_all_notifications_read,
    get_user_unread_count,
    get_user_notification_preferences,
    update_user_notification_preferences,
    get_global_notification_settings,
    update_global_notification_settings,
    get_notification_templates,
    get_notification_template_by_id,
    create_or_update_notification_template,
    rollback_notification_template,
    get_template_versions,
    schedule_bulk_notification_jobs
)
from utils.notifications.template_engine import TemplateEngine, compute_content_hash

router = APIRouter(prefix="/notifications", tags=["Notifications Management"])

# ==============================================================================
# WEBSOCKET ENDPOINT
# ==============================================================================

@router.websocket("/ws")
async def websocket_route(websocket: WebSocket):
    """
    Real-Time WebSocket stream for instant in-app alerts and badge sync.
    """
    await notification_websocket_endpoint(websocket)

# ==============================================================================
# USER NOTIFICATIONS
# ==============================================================================

@router.get("", response_model=Dict[str, Any])
async def list_user_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: Optional[str] = Query("ALL"),
    unread_only: bool = Query(False),
    current_user: str = Depends(get_current_user)
):
    """
    Returns paginated user notifications with category filtering and unread count.
    """
    items = get_user_notifications(
        user_id=current_user,
        limit=limit,
        offset=offset,
        filter_category=category,
        unread_only=unread_only
    )
    unread_count = await get_unread_count_cached(current_user)
    return {
        "notifications": items,
        "unread_count": unread_count,
        "limit": limit,
        "offset": offset
    }

@router.put("/{notification_id}/read")
async def mark_single_read(
    notification_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Marks a single notification as read and invalidates Redis badge cache.
    """
    success = mark_notification_read(notification_id, current_user)
    await ws_manager.invalidate_unread_cache(current_user)
    return {"success": success}

@router.put("/read-all")
async def mark_all_read(
    current_user: str = Depends(get_current_user)
):
    """
    Marks all notifications for the current user as read and updates cache.
    """
    count = mark_all_notifications_read(current_user)
    await ws_manager.set_cached_unread_count(current_user, 0)
    return {"success": True, "marked_count": count}

@router.get("/unread-count")
async def get_unread_badge_count(
    current_user: str = Depends(get_current_user)
):
    """
    Sub-millisecond lookup from Redis cache with DB fallback.
    """
    count = await get_unread_count_cached(current_user)
    return {"unread_count": count}

async def get_unread_count_cached(user_id: str) -> int:
    cached = await ws_manager.get_cached_unread_count(user_id)
    if cached is not None:
        return cached
    db_count = get_user_unread_count(user_id)
    await ws_manager.set_cached_unread_count(user_id, db_count)
    return db_count

# ==============================================================================
# USER PREFERENCES
# ==============================================================================

class PreferencesUpdateRequest(BaseModel):
    in_app_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None
    deadline_reminders_enabled: Optional[bool] = None
    post_completion_enabled: Optional[bool] = None
    streak_notifications_enabled: Optional[bool] = None

@router.get("/preferences")
async def get_preferences(current_user: str = Depends(get_current_user)):
    """
    Retrieves notification channel preferences for current user.
    """
    return get_user_notification_preferences(current_user)

@router.put("/preferences")
async def update_preferences(
    req: PreferencesUpdateRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Updates notification channel preferences.
    """
    current_prefs = get_user_notification_preferences(current_user)
    updates = req.dict(exclude_unset=True)
    current_prefs.update(updates)
    res = update_user_notification_preferences(current_user, current_prefs)
    return {"success": True, "preferences": res}

# ==============================================================================
# GLOBAL GOVERNANCE SETTINGS (DEVELOPER CONSOLE)
# ==============================================================================

class GlobalSettingsUpdateRequest(BaseModel):
    in_app_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None
    deadline_reminders_enabled: Optional[bool] = None
    post_completion_enabled: Optional[bool] = None
    streak_notifications_enabled: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = "22:00"
    quiet_hours_end: Optional[str] = "08:00"
    max_daily_per_user: Optional[int] = 10

@router.get("/global-settings")
async def get_global_settings():
    """
    Retrieves global platform governance policies.
    """
    return get_global_notification_settings()

@router.put("/global-settings")
async def update_global_settings(
    req: GlobalSettingsUpdateRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Updates global platform notification policies.
    """
    current = get_global_notification_settings()
    current.update(req.dict(exclude_unset=True))
    updated = update_global_notification_settings(current, user_id=current_user)
    return {"success": True, "settings": updated}

# ==============================================================================
# TEMPLATES MANAGEMENT
# ==============================================================================

class TemplateCreateUpdateRequest(BaseModel):
    id: Optional[str] = None
    notification_type: str
    channel: str = "ALL"
    variation_index: int = 0
    title_template: str
    body_template: str
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None

class TemplatePreviewRequest(BaseModel):
    title_template: str
    body_template: str
    sample_context: Dict[str, Any] = {}

class TemplateRollbackRequest(BaseModel):
    version_number: int

@router.get("/templates")
async def list_templates(
    notification_type: Optional[str] = Query(None),
    channel: Optional[str] = Query(None)
):
    """
    Lists notification templates.
    """
    return get_notification_templates(notification_type=notification_type, channel=channel)

@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """
    Gets single template.
    """
    t = get_notification_template_by_id(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t

@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreateUpdateRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Creates or updates template with normalized content-hash and immutable versioning.
    """
    res = create_or_update_notification_template(payload.dict(), user_id=current_user)
    return {"success": True, "template": res}

@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    payload: TemplateCreateUpdateRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Updates template, bumping version and preserving historical snapshot.
    """
    data = payload.dict()
    data["id"] = template_id
    res = create_or_update_notification_template(data, user_id=current_user)
    return {"success": True, "template": res}

@router.get("/templates/{template_id}/versions")
async def list_template_versions(template_id: str):
    """
    Retrieves immutable historical versions for template.
    """
    return get_template_versions(template_id)

@router.post("/templates/{template_id}/rollback")
async def rollback_template_version(
    template_id: str,
    req: TemplateRollbackRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Rolls back template to historical version.
    """
    res = rollback_notification_template(template_id, req.version_number)
    if not res:
        raise HTTPException(status_code=404, detail="Target version not found")
    return {"success": True, "template": res}

@router.post("/templates/preview")
async def preview_template(req: TemplatePreviewRequest):
    """
    Live dynamic compilation preview for developer console.
    """
    rendered_title, rendered_body = TemplateEngine.render_notification(
        req.title_template,
        req.body_template,
        req.sample_context
    )
    content_hash = compute_content_hash(req.title_template, req.body_template)
    return {
        "rendered_title": rendered_title,
        "rendered_body": rendered_body,
        "content_hash": content_hash
    }

# ==============================================================================
# ATOMIC BULK ASSIGNMENT DISPATCHER
# ==============================================================================

class AssignmentNotificationRequest(BaseModel):
    user_ids: List[str]
    notification_type: str = "JOB_ASSIGNED"
    title: str
    message: str
    assignment_id: Optional[str] = None
    metadata: Dict[str, Any] = {}

@router.post("/send-assignment-notification")
async def send_assignment_notification(
    req: AssignmentNotificationRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Decoupled assignment dispatcher enqueuing directly to notification_jobs
    via schedule_bulk_notification_jobs_rpc with zero blocking HTTP threads.
    """
    meta = dict(req.metadata)
    meta["title"] = req.title
    meta["message"] = req.message
    meta["dispatched_by"] = current_user

    inserted_count = schedule_bulk_notification_jobs(
        user_ids=req.user_ids,
        notification_type=req.notification_type,
        metadata=meta,
        assignment_id=req.assignment_id
    )

    return {
        "success": True,
        "enqueued_jobs_count": inserted_count,
        "target_users_count": len(req.user_ids)
    }
