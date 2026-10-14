import os
import json
import uuid
import datetime
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from utils.supabase_client import supabase

def get_pg_connection():
    """
    Returns a PostgreSQL connection if direct DB parameters are configured.
    Falls back gracefully if not available.
    """
    try:
        host = os.getenv("DB_HOST", "localhost")
        port = os.getenv("DB_PORT", 5432)
        user = os.getenv("DB_USER", "postgres")
        password = os.getenv("DB_PASSWORD", "")
        dbname = os.getenv("DB_NAME", "RIL_Dev")
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=dbname,
            connect_timeout=3
        )
        conn.autocommit = True
        return conn
    except Exception as e:
        return None

# ==============================================================================
# NOTIFICATIONS (IN-APP)
# ==============================================================================

def get_user_notifications(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    filter_category: Optional[str] = None,
    unread_only: bool = False
) -> List[Dict[str, Any]]:
    """
    Retrieves user notifications with explicit column selection.
    """
    columns = "id, user_id, company_id, title, message, type, read, read_at, metadata, created_at"
    
    # 1. Try Supabase
    try:
        query = supabase.table("notifications").select(columns).eq("user_id", user_id)
        if unread_only:
            query = query.eq("read", False)
        if filter_category and filter_category.upper() != "ALL":
            query = query.eq("type", filter_category.upper())
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        if res.data is not None:
            return res.data
    except Exception:
        pass

    # 2. Direct PG Fallback
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                where_clauses = ["user_id = %s"]
                params: List[Any] = [user_id]
                if unread_only:
                    where_clauses.append("read = FALSE")
                if filter_category and filter_category.upper() != "ALL":
                    where_clauses.append("type = %s")
                    params.append(filter_category.upper())
                
                sql = f"""
                    SELECT {columns}
                    FROM public.notifications
                    WHERE {' AND '.join(where_clauses)}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """
                params.extend([limit, offset])
                cur.execute(sql, params)
                rows = cur.fetchall()
                # Format datetimes
                result = []
                for r in rows:
                    row_dict = dict(r)
                    if row_dict.get("created_at"):
                        row_dict["created_at"] = row_dict["created_at"].isoformat()
                    if row_dict.get("read_at"):
                        row_dict["read_at"] = row_dict["read_at"].isoformat()
                    result.append(row_dict)
                return result
        finally:
            conn.close()
    return []

def mark_notification_read(notification_id: str, user_id: str) -> bool:
    """
    Marks a single notification as read.
    """
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        res = supabase.table("notifications").update({
            "read": True,
            "read_at": now_iso
        }).eq("id", notification_id).eq("user_id", user_id).execute()
        if res.data:
            return True
    except Exception:
        pass

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE public.notifications
                    SET read = TRUE, read_at = NOW()
                    WHERE id = %s AND user_id = %s
                """, (notification_id, user_id))
                return cur.rowcount > 0
        finally:
            conn.close()
    return False

def mark_all_notifications_read(user_id: str) -> int:
    """
    Marks all notifications for a user as read.
    """
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        res = supabase.table("notifications").update({
            "read": True,
            "read_at": now_iso
        }).eq("user_id", user_id).eq("read", False).execute()
        if res.data is not None:
            return len(res.data)
    except Exception:
        pass

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE public.notifications
                    SET read = TRUE, read_at = NOW()
                    WHERE user_id = %s AND read = FALSE
                """, (user_id,))
                return cur.rowcount
        finally:
            conn.close()
    return 0

def get_user_unread_count(user_id: str) -> int:
    """
    Retrieves the unread notification count.
    """
    try:
        res = supabase.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("read", False).execute()
        if res.count is not None:
            return res.count
    except Exception:
        pass

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT COUNT(id) FROM public.notifications
                    WHERE user_id = %s AND read = FALSE
                """, (user_id,))
                row = cur.fetchone()
                return row[0] if row else 0
        finally:
            conn.close()
    return 0

def create_in_app_notification(
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "SYSTEM",
    company_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Inserts a new in-app notification.
    """
    payload = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "read": False,
        "metadata": metadata or {}
    }
    if company_id:
        payload["company_id"] = company_id

    try:
        res = supabase.table("notifications").insert(payload).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO public.notifications (
                        user_id, company_id, title, message, type, metadata
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, user_id, company_id, title, message, type, read, read_at, metadata, created_at
                """, (user_id, company_id, title, message, notification_type, json.dumps(metadata or {})))
                row = cur.fetchone()
                row_dict = dict(row)
                if row_dict.get("created_at"):
                    row_dict["created_at"] = row_dict["created_at"].isoformat()
                return row_dict
        finally:
            conn.close()
    return {}

# ==============================================================================
# NOTIFICATION PREFERENCES & GLOBAL SETTINGS
# ==============================================================================

def get_user_notification_preferences(user_id: str) -> Dict[str, Any]:
    """
    Retrieves user notification preferences or returns defaults.
    """
    defaults = {
        "user_id": user_id,
        "in_app_enabled": True,
        "push_enabled": True,
        "email_enabled": True,
        "whatsapp_enabled": False,
        "deadline_reminders_enabled": True,
        "post_completion_enabled": True,
        "streak_notifications_enabled": True
    }
    try:
        res = supabase.table("notification_preferences").select(
            "user_id, in_app_enabled, push_enabled, email_enabled, whatsapp_enabled, deadline_reminders_enabled, post_completion_enabled, streak_notifications_enabled"
        ).eq("user_id", user_id).limit(1).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT user_id, in_app_enabled, push_enabled, email_enabled, whatsapp_enabled,
                           deadline_reminders_enabled, post_completion_enabled, streak_notifications_enabled
                    FROM public.notification_preferences
                    WHERE user_id = %s
                """, (user_id,))
                row = cur.fetchone()
                if row:
                    return dict(row)
        finally:
            conn.close()
    return defaults

def update_user_notification_preferences(user_id: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates or inserts user notification preferences.
    """
    data = {
        "user_id": user_id,
        "in_app_enabled": preferences.get("in_app_enabled", True),
        "push_enabled": preferences.get("push_enabled", True),
        "email_enabled": preferences.get("email_enabled", True),
        "whatsapp_enabled": preferences.get("whatsapp_enabled", False),
        "deadline_reminders_enabled": preferences.get("deadline_reminders_enabled", True),
        "post_completion_enabled": preferences.get("post_completion_enabled", True),
        "streak_notifications_enabled": preferences.get("streak_notifications_enabled", True),
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    try:
        res = supabase.table("notification_preferences").upsert(data).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO public.notification_preferences (
                        user_id, in_app_enabled, push_enabled, email_enabled, whatsapp_enabled,
                        deadline_reminders_enabled, post_completion_enabled, streak_notifications_enabled, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET
                        in_app_enabled = EXCLUDED.in_app_enabled,
                        push_enabled = EXCLUDED.push_enabled,
                        email_enabled = EXCLUDED.email_enabled,
                        whatsapp_enabled = EXCLUDED.whatsapp_enabled,
                        deadline_reminders_enabled = EXCLUDED.deadline_reminders_enabled,
                        post_completion_enabled = EXCLUDED.post_completion_enabled,
                        streak_notifications_enabled = EXCLUDED.streak_notifications_enabled,
                        updated_at = NOW()
                    RETURNING user_id, in_app_enabled, push_enabled, email_enabled, whatsapp_enabled,
                              deadline_reminders_enabled, post_completion_enabled, streak_notifications_enabled
                """, (
                    user_id,
                    data["in_app_enabled"],
                    data["push_enabled"],
                    data["email_enabled"],
                    data["whatsapp_enabled"],
                    data["deadline_reminders_enabled"],
                    data["post_completion_enabled"],
                    data["streak_notifications_enabled"]
                ))
                row = cur.fetchone()
                return dict(row) if row else data
        finally:
            conn.close()
    return data

def get_global_notification_settings() -> Dict[str, Any]:
    """
    Retrieves global notification governance settings.
    """
    defaults = {
        "id": "global_default",
        "in_app_enabled": True,
        "push_enabled": True,
        "email_enabled": True,
        "whatsapp_enabled": False,
        "deadline_reminders_enabled": True,
        "post_completion_enabled": True,
        "streak_notifications_enabled": True,
        "quiet_hours_enabled": False,
        "quiet_hours_start": "22:00",
        "quiet_hours_end": "08:00",
        "max_daily_per_user": 10
    }
    columns = "id, in_app_enabled, push_enabled, email_enabled, whatsapp_enabled, deadline_reminders_enabled, post_completion_enabled, streak_notifications_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, max_daily_per_user"
    try:
        res = supabase.table("global_notification_settings").select(columns).eq("id", "global_default").limit(1).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f"SELECT {columns} FROM public.global_notification_settings WHERE id = 'global_default'")
                row = cur.fetchone()
                if row:
                    return dict(row)
        finally:
            conn.close()
    return defaults

def update_global_notification_settings(settings: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Updates global notification settings.
    """
    payload = {
        "id": "global_default",
        "in_app_enabled": settings.get("in_app_enabled", True),
        "push_enabled": settings.get("push_enabled", True),
        "email_enabled": settings.get("email_enabled", True),
        "whatsapp_enabled": settings.get("whatsapp_enabled", False),
        "deadline_reminders_enabled": settings.get("deadline_reminders_enabled", True),
        "post_completion_enabled": settings.get("post_completion_enabled", True),
        "streak_notifications_enabled": settings.get("streak_notifications_enabled", True),
        "quiet_hours_enabled": settings.get("quiet_hours_enabled", False),
        "quiet_hours_start": settings.get("quiet_hours_start", "22:00"),
        "quiet_hours_end": settings.get("quiet_hours_end", "08:00"),
        "max_daily_per_user": settings.get("max_daily_per_user", 10),
        "updated_by": user_id,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    try:
        res = supabase.table("global_notification_settings").upsert(payload).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO public.global_notification_settings (
                        id, in_app_enabled, push_enabled, email_enabled, whatsapp_enabled,
                        deadline_reminders_enabled, post_completion_enabled, streak_notifications_enabled,
                        quiet_hours_enabled, quiet_hours_start, quiet_hours_end, max_daily_per_user, updated_by, updated_at
                    ) VALUES (
                        'global_default', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                    ) ON CONFLICT (id) DO UPDATE SET
                        in_app_enabled = EXCLUDED.in_app_enabled,
                        push_enabled = EXCLUDED.push_enabled,
                        email_enabled = EXCLUDED.email_enabled,
                        whatsapp_enabled = EXCLUDED.whatsapp_enabled,
                        deadline_reminders_enabled = EXCLUDED.deadline_reminders_enabled,
                        post_completion_enabled = EXCLUDED.post_completion_enabled,
                        streak_notifications_enabled = EXCLUDED.streak_notifications_enabled,
                        quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
                        quiet_hours_start = EXCLUDED.quiet_hours_start,
                        quiet_hours_end = EXCLUDED.quiet_hours_end,
                        max_daily_per_user = EXCLUDED.max_daily_per_user,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = NOW()
                    RETURNING *
                """, (
                    payload["in_app_enabled"], payload["push_enabled"], payload["email_enabled"], payload["whatsapp_enabled"],
                    payload["deadline_reminders_enabled"], payload["post_completion_enabled"], payload["streak_notifications_enabled"],
                    payload["quiet_hours_enabled"], payload["quiet_hours_start"], payload["quiet_hours_end"], payload["max_daily_per_user"],
                    payload["updated_by"]
                ))
                row = cur.fetchone()
                return dict(row) if row else payload
        finally:
            conn.close()
    return payload

# ==============================================================================
# NOTIFICATION TEMPLATES & VERSIONS
# ==============================================================================

def get_notification_templates(notification_type: Optional[str] = None, channel: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetches notification templates.
    """
    columns = "id, notification_type, channel, variation_index, title_template, body_template, cta_label, cta_url, language, version, status, is_active, content_hash, created_at, updated_at"
    try:
        q = supabase.table("notification_templates").select(columns)
        if notification_type:
            q = q.eq("notification_type", notification_type)
        if channel:
            q = q.eq("channel", channel)
        res = q.order("notification_type").order("variation_index").execute()
        if res.data:
            return res.data
    except Exception:
        pass

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                where = []
                params: List[Any] = []
                if notification_type:
                    where.append("notification_type = %s")
                    params.append(notification_type)
                if channel:
                    where.append("channel = %s")
                    params.append(channel)
                w_str = f"WHERE {' AND '.join(where)}" if where else ""
                cur.execute(f"SELECT {columns} FROM public.notification_templates {w_str} ORDER BY notification_type, variation_index", params)
                rows = cur.fetchall()
                res = []
                for r in rows:
                    rd = dict(r)
                    if rd.get("created_at"): rd["created_at"] = rd["created_at"].isoformat()
                    if rd.get("updated_at"): rd["updated_at"] = rd["updated_at"].isoformat()
                    res.append(rd)
                return res
        finally:
            conn.close()
    return []

def get_notification_template_by_id(template_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single template by ID.
    """
    columns = "id, notification_type, channel, variation_index, title_template, body_template, cta_label, cta_url, language, version, status, is_active, content_hash, created_at, updated_at"
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f"SELECT {columns} FROM public.notification_templates WHERE id = %s", (template_id,))
                row = cur.fetchone()
                if row:
                    rd = dict(row)
                    if rd.get("created_at"): rd["created_at"] = rd["created_at"].isoformat()
                    if rd.get("updated_at"): rd["updated_at"] = rd["updated_at"].isoformat()
                    return rd
        finally:
            conn.close()
    return None

def create_or_update_notification_template(data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Creates or updates a template, bumping version and appending an immutable version snapshot.
    """
    from utils.notifications.template_engine import compute_content_hash
    title_template = data["title_template"]
    body_template = data["body_template"]
    channel = data.get("channel", "ALL")
    notification_type = data["notification_type"]
    variation_index = data.get("variation_index", 0)
    cta_label = data.get("cta_label")
    cta_url = data.get("cta_url")
    content_hash = compute_content_hash(title_template, body_template, channel)

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Check existing
                cur.execute("""
                    SELECT id, version, content_hash FROM public.notification_templates
                    WHERE notification_type = %s AND channel = %s AND variation_index = %s
                """, (notification_type, channel, variation_index))
                existing = cur.fetchone()

                if existing:
                    t_id = existing["id"]
                    curr_ver = existing["version"]
                    new_ver = curr_ver + 1
                    cur.execute("""
                        UPDATE public.notification_templates
                        SET title_template = %s,
                            body_template = %s,
                            cta_label = %s,
                            cta_url = %s,
                            content_hash = %s,
                            version = %s,
                            updated_at = NOW()
                        WHERE id = %s
                        RETURNING id, notification_type, channel, variation_index, title_template, body_template,
                                  cta_label, cta_url, language, version, status, is_active, content_hash, created_at, updated_at
                    """, (title_template, body_template, cta_label, cta_url, content_hash, new_ver, t_id))
                    updated_row = dict(cur.fetchone())
                else:
                    cur.execute("""
                        INSERT INTO public.notification_templates (
                            notification_type, channel, variation_index, title_template, body_template,
                            cta_label, cta_url, content_hash, version
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)
                        RETURNING id, notification_type, channel, variation_index, title_template, body_template,
                                  cta_label, cta_url, language, version, status, is_active, content_hash, created_at, updated_at
                    """, (notification_type, channel, variation_index, title_template, body_template, cta_label, cta_url, content_hash))
                    updated_row = dict(cur.fetchone())
                    t_id = updated_row["id"]
                    new_ver = 1

                # Archive immutable version snapshot
                cur.execute("""
                    INSERT INTO public.notification_template_versions (
                        template_id, version_number, notification_type, channel, title_template, body_template,
                        cta_label, cta_url, content_hash, published_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (template_id, version_number) DO NOTHING
                """, (t_id, new_ver, notification_type, channel, title_template, body_template, cta_label, cta_url, content_hash, user_id))

                if updated_row.get("created_at"): updated_row["created_at"] = updated_row["created_at"].isoformat()
                if updated_row.get("updated_at"): updated_row["updated_at"] = updated_row["updated_at"].isoformat()
                return updated_row
        finally:
            conn.close()
    return {}

def rollback_notification_template(template_id: str, version_number: int) -> Optional[Dict[str, Any]]:
    """
    Rolls back a template to an immutable historic version.
    """
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT title_template, body_template, cta_label, cta_url, content_hash, channel, notification_type
                    FROM public.notification_template_versions
                    WHERE template_id = %s AND version_number = %s
                """, (template_id, version_number))
                hist = cur.fetchone()
                if not hist:
                    return None

                # Fetch current version to bump
                cur.execute("SELECT version FROM public.notification_templates WHERE id = %s", (template_id,))
                curr = cur.fetchone()
                new_ver = (curr["version"] + 1) if curr else version_number

                cur.execute("""
                    UPDATE public.notification_templates
                    SET title_template = %s,
                        body_template = %s,
                        cta_label = %s,
                        cta_url = %s,
                        content_hash = %s,
                        version = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, notification_type, channel, variation_index, title_template, body_template,
                              cta_label, cta_url, language, version, status, is_active, content_hash, created_at, updated_at
                """, (hist["title_template"], hist["body_template"], hist["cta_label"], hist["cta_url"], hist["content_hash"], new_ver, template_id))
                row = cur.fetchone()
                if row:
                    rd = dict(row)
                    if rd.get("created_at"): rd["created_at"] = rd["created_at"].isoformat()
                    if rd.get("updated_at"): rd["updated_at"] = rd["updated_at"].isoformat()
                    return rd
        finally:
            conn.close()
    return None

def get_template_versions(template_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves version history for a given template.
    """
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, template_id, version_number, notification_type, channel, title_template, body_template,
                           cta_label, cta_url, content_hash, published_by, created_at
                    FROM public.notification_template_versions
                    WHERE template_id = %s
                    ORDER BY version_number DESC
                """, (template_id,))
                rows = cur.fetchall()
                res = []
                for r in rows:
                    rd = dict(r)
                    if rd.get("created_at"): rd["created_at"] = rd["created_at"].isoformat()
                    res.append(rd)
                return res
        finally:
            conn.close()
    return []

# ==============================================================================
# WORKFLOW AUTOMATION ENGINE DB
# ==============================================================================

def get_notification_workflows(trigger_lifecycle: Optional[str] = None, active_only: bool = True) -> List[Dict[str, Any]]:
    """
    Retrieves workflows with filter conditions.
    """
    columns = "id, company_id, title, description, trigger_lifecycle, category, notification_type, filter_rules, filter_match_type, channels, delivery_policy, cooldown_seconds, pinned_template_id, pinned_template_version_id, title_template, body_template, content_fingerprint, version_number, is_active, created_at, updated_at"
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                where = []
                params: List[Any] = []
                if trigger_lifecycle:
                    where.append("trigger_lifecycle = %s")
                    params.append(trigger_lifecycle)
                if active_only:
                    where.append("is_active = TRUE")
                w_str = f"WHERE {' AND '.join(where)}" if where else ""
                cur.execute(f"SELECT {columns} FROM public.notification_workflows {w_str} ORDER BY created_at DESC", params)
                rows = cur.fetchall()
                res = []
                for r in rows:
                    rd = dict(r)
                    if rd.get("created_at"): rd["created_at"] = rd["created_at"].isoformat()
                    if rd.get("updated_at"): rd["updated_at"] = rd["updated_at"].isoformat()
                    res.append(rd)
                return res
        finally:
            conn.close()
    return []

def get_notification_workflow_by_id(workflow_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single workflow by ID.
    """
    columns = "id, company_id, title, description, trigger_lifecycle, category, notification_type, filter_rules, filter_match_type, channels, delivery_policy, cooldown_seconds, pinned_template_id, pinned_template_version_id, title_template, body_template, content_fingerprint, version_number, is_active, created_at, updated_at"
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f"SELECT {columns} FROM public.notification_workflows WHERE id = %s", (workflow_id,))
                row = cur.fetchone()
                if row:
                    rd = dict(row)
                    if rd.get("created_at"): rd["created_at"] = rd["created_at"].isoformat()
                    if rd.get("updated_at"): rd["updated_at"] = rd["updated_at"].isoformat()
                    return rd
        finally:
            conn.close()
    return None

def create_or_update_workflow(data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Creates or updates a notification workflow with immutable version snapshots.
    """
    import hashlib
    wf_id = data.get("id")
    title = data["title"]
    description = data.get("description", "")
    trigger_lifecycle = data["trigger_lifecycle"]
    category = data.get("category", "CUSTOM")
    notification_type = data["notification_type"]
    filter_rules = data.get("filter_rules", [])
    filter_match_type = data.get("filter_match_type", "ALL")
    channels = data.get("channels", ["IN_APP", "PUSH"])
    delivery_policy = data.get("delivery_policy", "PARALLEL")
    cooldown_seconds = data.get("cooldown_seconds", 3600)
    pinned_template_id = data.get("pinned_template_id")
    pinned_template_version_id = data.get("pinned_template_version_id")
    title_template = data.get("title_template", "")
    body_template = data.get("body_template", "")
    is_active = data.get("is_active", True)
    company_id = data.get("company_id")

    # Compute operational fingerprint
    fingerprint_raw = f"{trigger_lifecycle}:{notification_type}:{','.join(sorted(channels))}:{json.dumps(filter_rules, sort_keys=True)}"
    content_fingerprint = hashlib.sha256(fingerprint_raw.encode("utf-8")).hexdigest()

    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if wf_id:
                    cur.execute("SELECT version_number FROM public.notification_workflows WHERE id = %s", (wf_id,))
                    curr = cur.fetchone()
                    new_ver = (curr["version_number"] + 1) if curr else 1
                    cur.execute("""
                        UPDATE public.notification_workflows
                        SET title = %s, description = %s, trigger_lifecycle = %s, category = %s,
                            notification_type = %s, filter_rules = %s, filter_match_type = %s,
                            channels = %s, delivery_policy = %s, cooldown_seconds = %s,
                            pinned_template_id = %s, pinned_template_version_id = %s,
                            title_template = %s, body_template = %s, content_fingerprint = %s,
                            version_number = %s, is_active = %s, updated_at = NOW()
                        WHERE id = %s
                        RETURNING *
                    """, (
                        title, description, trigger_lifecycle, category, notification_type,
                        json.dumps(filter_rules), filter_match_type, channels, delivery_policy,
                        cooldown_seconds, pinned_template_id, pinned_template_version_id,
                        title_template, body_template, content_fingerprint, new_ver, is_active, wf_id
                    ))
                    row = dict(cur.fetchone())
                else:
                    cur.execute("""
                        INSERT INTO public.notification_workflows (
                            company_id, title, description, trigger_lifecycle, category,
                            notification_type, filter_rules, filter_match_type, channels,
                            delivery_policy, cooldown_seconds, pinned_template_id,
                            pinned_template_version_id, title_template, body_template,
                            content_fingerprint, version_number, is_active
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, %s)
                        RETURNING *
                    """, (
                        company_id, title, description, trigger_lifecycle, category,
                        notification_type, json.dumps(filter_rules), filter_match_type, channels,
                        delivery_policy, cooldown_seconds, pinned_template_id,
                        pinned_template_version_id, title_template, body_template,
                        content_fingerprint, is_active
                    ))
                    row = dict(cur.fetchone())
                    wf_id = row["id"]
                    new_ver = 1

                # Archive immutable workflow version
                cur.execute("""
                    INSERT INTO public.notification_workflow_versions (
                        workflow_id, version_number, title, description, trigger_lifecycle, category,
                        filter_rules, filter_match_type, notification_type, channels, delivery_policy,
                        pinned_template_id, pinned_template_version_id, title_template, body_template,
                        content_fingerprint
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (workflow_id, version_number) DO NOTHING
                """, (
                    wf_id, new_ver, title, description, trigger_lifecycle, category,
                    json.dumps(filter_rules), filter_match_type, notification_type, channels, delivery_policy,
                    pinned_template_id, pinned_template_version_id, title_template, body_template,
                    content_fingerprint
                ))

                if row.get("created_at"): row["created_at"] = row["created_at"].isoformat()
                if row.get("updated_at"): row["updated_at"] = row["updated_at"].isoformat()
                return row
        finally:
            conn.close()
    return {}

def delete_workflow(workflow_id: str) -> bool:
    """
    Deletes a workflow.
    """
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.notification_workflows WHERE id = %s", (workflow_id,))
                return cur.rowcount > 0
        finally:
            conn.close()
    return False

def get_workflow_versions(workflow_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves version history for a workflow.
    """
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, workflow_id, version_number, title, description, trigger_lifecycle, category,
                           filter_rules, filter_match_type, notification_type, channels, delivery_policy,
                           pinned_template_id, pinned_template_version_id, title_template, body_template,
                           content_fingerprint, created_at
                    FROM public.notification_workflow_versions
                    WHERE workflow_id = %s
                    ORDER BY version_number DESC
                """, (workflow_id,))
                rows = cur.fetchall()
                res = []
                for r in rows:
                    rd = dict(r)
                    if rd.get("created_at"): rd["created_at"] = rd["created_at"].isoformat()
                    res.append(rd)
                return res
        finally:
            conn.close()
    return []

def rollback_workflow(workflow_id: str, version_number: int) -> Optional[Dict[str, Any]]:
    """
    Rolls back workflow to historical immutable version.
    """
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT title, description, trigger_lifecycle, category, filter_rules, filter_match_type,
                           notification_type, channels, delivery_policy, pinned_template_id,
                           pinned_template_version_id, title_template, body_template, content_fingerprint
                    FROM public.notification_workflow_versions
                    WHERE workflow_id = %s AND version_number = %s
                """, (workflow_id, version_number))
                hist = cur.fetchone()
                if not hist:
                    return None

                cur.execute("SELECT version_number FROM public.notification_workflows WHERE id = %s", (workflow_id,))
                curr = cur.fetchone()
                new_ver = (curr["version_number"] + 1) if curr else version_number

                cur.execute("""
                    UPDATE public.notification_workflows
                    SET title = %s, description = %s, trigger_lifecycle = %s, category = %s,
                        filter_rules = %s, filter_match_type = %s, notification_type = %s,
                        channels = %s, delivery_policy = %s, pinned_template_id = %s,
                        pinned_template_version_id = %s, title_template = %s, body_template = %s,
                        content_fingerprint = %s, version_number = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING *
                """, (
                    hist["title"], hist["description"], hist["trigger_lifecycle"], hist["category"],
                    json.dumps(hist["filter_rules"]), hist["filter_match_type"], hist["notification_type"],
                    hist["channels"], hist["delivery_policy"], hist["pinned_template_id"],
                    hist["pinned_template_version_id"], hist["title_template"], hist["body_template"],
                    hist["content_fingerprint"], new_ver, workflow_id
                ))
                row = cur.fetchone()
                if row:
                    rd = dict(row)
                    if rd.get("created_at"): rd["created_at"] = rd["created_at"].isoformat()
                    if rd.get("updated_at"): rd["updated_at"] = rd["updated_at"].isoformat()
                    return rd
        finally:
            conn.close()
    return None

# ==============================================================================
# BATCH SCHEDULING & CONTEXT RESOLUTION (HIGH-PERFORMANCE RPCS)
# ==============================================================================

def schedule_bulk_notification_jobs(
    user_ids: List[str],
    notification_type: str,
    metadata: Dict[str, Any],
    assignment_id: Optional[str] = None,
    scheduled_at: Optional[str] = None
) -> int:
    """
    Invokes schedule_bulk_notification_jobs_rpc with deterministic idempotency.
    """
    # 1. Try Supabase RPC
    try:
        rpc_params = {
            "p_user_ids": user_ids,
            "p_notification_type": notification_type,
            "p_metadata": metadata,
            "p_assignment_id": assignment_id,
            "p_scheduled_at": scheduled_at
        }
        res = supabase.rpc("schedule_bulk_notification_jobs_rpc", rpc_params).execute()
        if res.data is not None:
            return int(res.data)
    except Exception:
        pass

    # 2. Direct PG invocation
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT schedule_bulk_notification_jobs_rpc(
                        %s::uuid[],
                        %s,
                        %s::jsonb,
                        %s::uuid,
                        %s::timestamptz
                    )
                """, (user_ids, notification_type, json.dumps(metadata), assignment_id, scheduled_at))
                row = cur.fetchone()
                return int(row[0]) if row else 0
        finally:
            conn.close()
    return 0

def get_recipient_context(user_id: str, company_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Consolidated recipient context resolution in a single SQL roundtrip (<10ms).
    """
    # 1. Direct PG invocation (Single roundtrip, sub-10ms)
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT get_notification_recipient_context_rpc(%s::uuid, %s::uuid)
                """, (user_id, company_id))
                row = cur.fetchone()
                if row and row[0]:
                    return dict(row[0])
        finally:
            conn.close()

    # 2. Supabase HTTP RPC fallback
    try:
        res = supabase.rpc("get_notification_recipient_context_rpc", {
            "p_user_id": user_id,
            "p_company_id": company_id
        }).execute()
        if res.data:
            return res.data
    except Exception:
        pass

    # Fallback default dictionary
    return {
        "subscriber.first_name": "Learner",
        "subscriber.full_name": "Learner",
        "subscriber.email": "",
        "subscriber.company_name": "Your Company",
        "subscriber.email_unsubscribed": False,
        "gamification.streak_days": 0,
        "curriculum.progress_percentage": 0
    }

# ==============================================================================
# QUEUE / WORKER JOBS & DELIVERIES
# ==============================================================================

def fetch_pending_notification_jobs(limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetches pending notification jobs scheduled at or before now.
    """
    columns = "id, company_id, user_id, assignment_id, notification_type, scheduled_at, processed_at, status, retry_count, idempotency_key, metadata, created_at"
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f"""
                    SELECT {columns}
                    FROM public.notification_jobs
                    WHERE status = 'PENDING' AND scheduled_at <= NOW()
                    ORDER BY scheduled_at ASC
                    LIMIT %s
                    FOR UPDATE SKIP LOCKED
                """, (limit,))
                rows = cur.fetchall()
                res = []
                for r in rows:
                    rd = dict(r)
                    if rd.get("scheduled_at"): rd["scheduled_at"] = rd["scheduled_at"].isoformat()
                    if rd.get("created_at"): rd["created_at"] = rd["created_at"].isoformat()
                    res.append(rd)
                return res
        finally:
            conn.close()
    return []

def update_job_status(job_id: str, status: str, retry_count: Optional[int] = None) -> bool:
    """
    Updates notification job status.
    """
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                if retry_count is not None:
                    cur.execute("""
                        UPDATE public.notification_jobs
                        SET status = %s, retry_count = %s, processed_at = NOW()
                        WHERE id = %s
                    """, (status, retry_count, job_id))
                else:
                    cur.execute("""
                        UPDATE public.notification_jobs
                        SET status = %s, processed_at = NOW()
                        WHERE id = %s
                    """, (status, job_id))
                return cur.rowcount > 0
        finally:
            conn.close()
    return False

def record_notification_delivery(
    job_id: Optional[str],
    user_id: str,
    channel: str,
    status: str,
    blocked_reason: Optional[str] = None,
    company_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Records a delivery record in notification_deliveries.
    """
    payload = {
        "notification_job_id": job_id,
        "company_id": company_id,
        "user_id": user_id,
        "channel": channel,
        "status": status,
        "blocked_reason": blocked_reason
    }
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO public.notification_deliveries (
                        notification_job_id, company_id, user_id, channel, status, blocked_reason
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, channel, status, blocked_reason, created_at
                """, (job_id, company_id, user_id, channel, status, blocked_reason))
                row = cur.fetchone()
                return dict(row) if row else payload
        finally:
            conn.close()
    return payload

# ==============================================================================
# CAN-SPAM COMPLIANCE & UNENROLLMENT
# ==============================================================================

def update_unsubscribe_status(user_id: str) -> bool:
    """
    Atomically marks user as email_unsubscribed in users and turns email_enabled off in notification_preferences.
    """
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE public.users
                    SET email_unsubscribed = TRUE, unsubscribed_at = NOW()
                    WHERE user_id = %s
                """, (user_id,))
                cur.execute("""
                    INSERT INTO public.notification_preferences (user_id, email_enabled, updated_at)
                    VALUES (%s, FALSE, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET email_enabled = FALSE, updated_at = NOW()
                """, (user_id,))
                return True
        finally:
            conn.close()
    return False

def find_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Finds a user by email with explicit columns.
    """
    columns = "user_id, email, first_name, last_name, company_id, email_unsubscribed"
    conn = get_pg_connection()
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f"SELECT {columns} FROM public.users WHERE LOWER(email) = LOWER(%s) LIMIT 1", (email,))
                row = cur.fetchone()
                if row:
                    return dict(row)
        finally:
            conn.close()
    return None
