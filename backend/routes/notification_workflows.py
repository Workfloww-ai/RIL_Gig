import hashlib
import json
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from utils.jwt_auth import get_current_user
from db.notifications_db import (
    get_notification_workflows,
    get_notification_workflow_by_id,
    create_or_update_workflow,
    delete_workflow,
    get_workflow_versions,
    rollback_workflow
)
from utils.notifications.workflow_engine import WorkflowEngine
from utils.notifications.template_engine import TemplateEngine
from utils.notifications.registry_contracts import TRIGGER_LIFECYCLES, SYSTEM_VARIABLES

router = APIRouter(prefix="/notifications/workflows", tags=["Notification Workflows Automation"])

def compute_workflow_fingerprint(
    trigger_lifecycle: str,
    notification_type: str,
    channels: List[str],
    filter_rules: List[Dict[str, Any]]
) -> str:
    """
    Deterministic SHA-256 operational definition fingerprint for conflict collision detection.
    """
    normalized_channels = ",".join(sorted(channels or []))
    normalized_rules = json.dumps(filter_rules or [], sort_keys=True)
    raw = f"{trigger_lifecycle}:{notification_type}:{normalized_channels}:{normalized_rules}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

# Request schemas
class WorkflowRule(BaseModel):
    field: str
    operator: str = "=="
    value: Any

class WorkflowCreateUpdateRequest(BaseModel):
    id: Optional[str] = None
    title: str = Field(..., max_length=128)
    description: Optional[str] = None
    trigger_lifecycle: str
    category: str = "CUSTOM"
    notification_type: str
    filter_rules: List[WorkflowRule] = []
    filter_match_type: str = "ALL" # ALL or ANY
    channels: List[str] = ["IN_APP", "PUSH"]
    delivery_policy: str = "PARALLEL" # PARALLEL or ORDERED_FALLBACK
    cooldown_seconds: int = 3600
    pinned_template_id: Optional[str] = None
    pinned_template_version_id: Optional[str] = None
    title_template: str
    body_template: str
    is_active: bool = True
    company_id: Optional[str] = None

class WorkflowStatusToggleRequest(BaseModel):
    is_active: bool

class WorkflowRollbackRequest(BaseModel):
    version_number: int

class WorkflowSimulateRequest(BaseModel):
    trigger_lifecycle: str
    filter_rules: List[WorkflowRule] = []
    filter_match_type: str = "ALL"
    title_template: str
    body_template: str
    sample_context: Dict[str, Any] = {}

# Endpoints

@router.get("", response_model=List[Dict[str, Any]])
async def list_workflows(
    trigger_lifecycle: Optional[str] = Query(None),
    active_only: bool = Query(False)
):
    """
    Lists all workflows, optionally filtered by trigger lifecycle.
    """
    return get_notification_workflows(trigger_lifecycle=trigger_lifecycle, active_only=active_only)

@router.get("/triggers", response_model=List[Dict[str, Any]])
async def get_available_triggers():
    """
    Returns standard system trigger lifecycle presets.
    """
    return TRIGGER_LIFECYCLES

@router.get("/variables", response_model=Dict[str, Dict[str, Any]])
async def get_available_variables():
    """
    Returns standardized system tokens and namespaces.
    """
    return SYSTEM_VARIABLES

@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str):
    """
    Gets single workflow by ID.
    """
    wf = get_notification_workflow_by_id(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workflow(
    payload: WorkflowCreateUpdateRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Creates a new workflow, calculating operational conflict fingerprint and archiving version 1.
    """
    data = payload.dict()
    # Conflict collision check
    fingerprint = compute_workflow_fingerprint(
        payload.trigger_lifecycle,
        payload.notification_type,
        payload.channels,
        [r.dict() for r in payload.filter_rules]
    )
    existing_all = get_notification_workflows(trigger_lifecycle=payload.trigger_lifecycle, active_only=True)
    conflicts = [w for w in existing_all if w.get("content_fingerprint") == fingerprint]

    created = create_or_update_workflow(data, user_id=current_user)
    return {
        "success": True,
        "workflow": created,
        "collision_warning": bool(conflicts),
        "conflicting_workflows": [c["id"] for c in conflicts]
    }

@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    payload: WorkflowCreateUpdateRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Updates workflow, bumping version number and storing immutable version history.
    """
    data = payload.dict()
    data["id"] = workflow_id
    updated = create_or_update_workflow(data, user_id=current_user)
    if not updated:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"success": True, "workflow": updated}

@router.delete("/{workflow_id}")
async def remove_workflow(
    workflow_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Deletes a workflow.
    """
    ok = delete_workflow(workflow_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"success": True, "message": "Workflow deleted"}

@router.patch("/{workflow_id}/status")
async def toggle_workflow_status(
    workflow_id: str,
    req: WorkflowStatusToggleRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Toggles workflow active/paused state.
    """
    wf = get_notification_workflow_by_id(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    wf["is_active"] = req.is_active
    updated = create_or_update_workflow(wf, user_id=current_user)
    return {"success": True, "is_active": updated.get("is_active")}

@router.get("/{workflow_id}/versions")
async def list_workflow_versions(workflow_id: str):
    """
    Returns full version history of the workflow.
    """
    versions = get_workflow_versions(workflow_id)
    return versions

@router.post("/{workflow_id}/rollback")
async def rollback_workflow_version(
    workflow_id: str,
    req: WorkflowRollbackRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Rolls back workflow to specified immutable historical version with zero data loss.
    """
    res = rollback_workflow(workflow_id, req.version_number)
    if not res:
        raise HTTPException(status_code=404, detail="Target version not found")
    return {"success": True, "workflow": res}

@router.post("/simulate")
async def simulate_workflow(req: WorkflowSimulateRequest):
    """
    Dry-run simulation endpoint evaluating filter rules and compiling templates with sample payload.
    """
    rules_dict = [r.dict() for r in req.filter_rules]
    rules_matched = WorkflowEngine.matches_rules(
        rules_dict,
        req.filter_match_type,
        req.sample_context
    )

    rendered_title, rendered_body = TemplateEngine.render_notification(
        req.title_template,
        req.body_template,
        req.sample_context
    )

    return {
        "rules_matched": rules_matched,
        "rendered_title": rendered_title,
        "rendered_body": rendered_body,
        "evaluated_rules_count": len(rules_dict)
    }
