import os
import json
import uuid
import hmac
import hashlib
import asyncio
import logging
import smtplib
import requests
from datetime import datetime, time, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional, Tuple

from arq.connections import RedisSettings
from utils.websocket_manager import ws_manager
from db.notifications_db import (
    fetch_pending_notification_jobs,
    update_job_status,
    record_notification_delivery,
    create_in_app_notification,
    get_user_notification_preferences,
    get_global_notification_settings,
    get_pg_connection
)

logger = logging.getLogger("ArqWorker")
logger.setLevel(logging.INFO)

# Global concurrency limiter: 20 simultaneous dispatches
DELIVERY_SEMAPHORE = asyncio.Semaphore(20)

def is_in_quiet_hours(start_str: str, end_str: str, check_time: Optional[datetime] = None) -> bool:
    """
    Evaluates whether the given time falls within quiet hours (e.g., 22:00 to 08:00).
    Handles windows that cross midnight.
    """
    try:
        sh, sm = map(int, start_str.split(":"))
        eh, em = map(int, end_str.split(":"))
        start_t = time(sh, sm)
        end_t = time(eh, em)

        now_t = (check_time or datetime.now()).time()

        if start_t > end_t: # Crosses midnight, e.g., 22:00 -> 08:00
            return now_t >= start_t or now_t < end_t
        else: # Same day, e.g., 01:00 -> 06:00
            return start_t <= now_t < end_t
    except Exception:
        return False

def generate_unsubscribe_token(user_id: str) -> str:
    """
    Generates a deterministic HMAC token for RFC 8058 one-click unsubscribe headers.
    """
    secret = os.getenv("JWT_SECRET_KEY", "unsub_secret")
    sig = hmac.new(secret.encode("utf-8"), user_id.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{user_id}:{sig}"

def verify_unsubscribe_token(token: str) -> Optional[str]:
    """
    Verifies HMAC signature of unsubscribe token.
    """
    try:
        parts = token.split(":", 1)
        if len(parts) != 2:
            return None
        user_id, sig = parts
        expected = hmac.new(
            os.getenv("JWT_SECRET_KEY", "unsub_secret").encode("utf-8"),
            user_id.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        if hmac.compare_digest(sig, expected):
            return user_id
    except Exception:
        pass
    return None

# ==============================================================================
# CHANNEL DISPATCH IMPLEMENTATIONS
# ==============================================================================

async def deliver_in_app(
    job_id: str,
    user_id: str,
    company_id: Optional[str],
    title: str,
    message: str,
    notification_type: str,
    metadata: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """
    Channel 1: In-App Notification.
    Inserts to notifications table, updates Redis unread badge count,
    and publishes via WebSocketManager with loopback deduplication.
    """
    try:
        notif = create_in_app_notification(
            user_id=user_id,
            company_id=company_id,
            title=title,
            message=message,
            notification_type=notification_type,
            metadata=metadata
        )

        # Emit over distributed WebSocket network
        await ws_manager.send_personal_message(
            user_id=user_id,
            message={
                "event": "new_notification",
                "data": notif
            }
        )
        record_notification_delivery(job_id, user_id, "IN_APP", "SENT", company_id=company_id)
        return True, None
    except Exception as e:
        err = f"In-app delivery failed: {str(e)}"
        record_notification_delivery(job_id, user_id, "IN_APP", "FAILED", blocked_reason=err, company_id=company_id)
        return False, err

async def deliver_push(
    job_id: str,
    user_id: str,
    company_id: Optional[str],
    title: str,
    message: str,
    metadata: Dict[str, Any],
    quiet_hours_active: bool,
    quiet_hours_bypass: bool
) -> Tuple[bool, Optional[str]]:
    """
    Channel 2: Mobile Push via Firebase Cloud Messaging (FCM).
    Enforces quiet hours suppression unless quiet_hours_bypass is True.
    """
    if quiet_hours_active and not quiet_hours_bypass:
        reason = "SUPPRESSED_QUIET_HOURS"
        record_notification_delivery(job_id, user_id, "PUSH", "SUPPRESSED", blocked_reason=reason, company_id=company_id)
        return False, reason

    # FCM Notification formatting with high importance Android channel
    try:
        import firebase_admin
        from firebase_admin import messaging

        # Attempt to read FCM token from metadata or user record
        fcm_token = metadata.get("fcm_token")
        if not fcm_token:
            # Check user record
            conn = get_pg_connection()
            if conn:
                try:
                    with conn.cursor() as cur:
                        cur.execute("SELECT fcm_token FROM public.users WHERE user_id = %s", (user_id,))
                        row = cur.fetchone()
                        if row and row[0]:
                            fcm_token = row[0]
                except Exception:
                    pass
                finally:
                    conn.close()

        if not fcm_token:
            reason = "NO_FCM_TOKEN"
            record_notification_delivery(job_id, user_id, "PUSH", "SUPPRESSED", blocked_reason=reason, company_id=company_id)
            return False, reason

        # Format FCM payload
        fcm_msg = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=message
            ),
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="lucid_high_importance_channel",
                    sound="default"
                )
            ),
            data={
                "action_url": metadata.get("action_url", ""),
                "notification_id": str(job_id)
            },
            token=fcm_token
        )
        # Send
        messaging.send(fcm_msg)
        record_notification_delivery(job_id, user_id, "PUSH", "SENT", company_id=company_id)
        return True, None
    except Exception as e:
        err = f"Push delivery error: {str(e)}"
        record_notification_delivery(job_id, user_id, "PUSH", "FAILED", blocked_reason=err, company_id=company_id)
        return False, err

async def deliver_email(
    job_id: str,
    user_id: str,
    company_id: Optional[str],
    title: str,
    message: str,
    metadata: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """
    Channel 3: Email via Resend API or SMTP dispatch with RFC 8058 headers
    and CAN-SPAM opt-out validation.
    """
    # 1. Fetch user email and unsubscribe status
    email = metadata.get("context", {}).get("subscriber.email")
    is_unsubscribed = metadata.get("context", {}).get("subscriber.email_unsubscribed", False)

    if not email:
        conn = get_pg_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT email, email_unsubscribed FROM public.users WHERE user_id = %s", (user_id,))
                    row = cur.fetchone()
                    if row:
                        email = row[0]
                        is_unsubscribed = row[1] or False
            finally:
                conn.close()

    if not email:
        reason = "NO_EMAIL_ADDRESS"
        record_notification_delivery(job_id, user_id, "EMAIL", "SUPPRESSED", blocked_reason=reason, company_id=company_id)
        return False, reason

    if is_unsubscribed:
        reason = "USER_EMAIL_UNSUBSCRIBED"
        record_notification_delivery(job_id, user_id, "EMAIL", "SUPPRESSED", blocked_reason=reason, company_id=company_id)
        return False, reason

    # Prepare RFC 8058 One-Click List-Unsubscribe headers
    unsub_token = generate_unsubscribe_token(user_id)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    unsub_url = f"{frontend_url}/api/unsubscribe?token={unsub_token}"

    resend_key = os.getenv("RESEND_API_KEY")
    sender = os.getenv("SENDER_EMAIL", "notifications@sahyogi.in")

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #111827;">{title}</h2>
        <p style="color: #374151; font-size: 16px; line-height: 24px;">{message}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            You received this notification from SahYogi.<br />
            <a href="{unsub_url}" style="color: #6b7280; text-decoration: underline;">Unsubscribe from all emails</a>
        </p>
    </div>
    """

    # Dispatch via Resend API if configured
    if resend_key:
        try:
            resp = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": sender,
                    "to": [email],
                    "subject": title,
                    "html": html_body,
                    "headers": {
                        "List-Unsubscribe": f"<{unsub_url}>",
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
                    }
                },
                timeout=10
            )
            if resp.status_code < 400:
                record_notification_delivery(job_id, user_id, "EMAIL", "SENT", company_id=company_id)
                return True, None
            else:
                err = f"Resend API error: {resp.status_code} - {resp.text}"
                record_notification_delivery(job_id, user_id, "EMAIL", "FAILED", blocked_reason=err, company_id=company_id)
                return False, err
        except Exception as e:
            err = f"Resend request exception: {str(e)}"
            record_notification_delivery(job_id, user_id, "EMAIL", "FAILED", blocked_reason=err, company_id=company_id)
            return False, err

    # Otherwise fallback to SMTP with socket timeout 10s
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")

    if smtp_host:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = title
            msg["From"] = sender
            msg["To"] = email
            msg["List-Unsubscribe"] = f"<{unsub_url}>"
            msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(sender, [email], msg.as_string())

            record_notification_delivery(job_id, user_id, "EMAIL", "SENT", company_id=company_id)
            return True, None
        except Exception as e:
            err = f"SMTP error: {str(e)}"
            record_notification_delivery(job_id, user_id, "EMAIL", "FAILED", blocked_reason=err, company_id=company_id)
            return False, err

    # If neither email provider is configured, record suppression
    record_notification_delivery(job_id, user_id, "EMAIL", "SUPPRESSED", blocked_reason="NO_EMAIL_SERVICE_CONFIGURED", company_id=company_id)
    return False, "NO_EMAIL_SERVICE_CONFIGURED"

# ==============================================================================
# JOB ORCHESTRATION & POLICIES (PARALLEL VS ORDERED_FALLBACK)
# ==============================================================================

async def execute_job(job: Dict[str, Any]):
    """
    Processes a single notification job respecting:
    - Global platform settings (kill-switches, quiet hours)
    - User channel preferences
    - Delivery policies (PARALLEL vs ORDERED_FALLBACK)
    """
    async with DELIVERY_SEMAPHORE:
        job_id = job["id"]
        user_id = job["user_id"]
        company_id = job.get("company_id")
        metadata = job.get("metadata") or {}
        notification_type = job.get("notification_type", "SYSTEM")

        title = metadata.get("title", "New Notification")
        message = metadata.get("message", "")
        requested_channels = metadata.get("channels", ["IN_APP", "PUSH"])
        delivery_policy = metadata.get("delivery_policy", "PARALLEL").upper()
        quiet_hours_bypass = metadata.get("quiet_hours_bypass", False)

        # 1. Fetch Global Platform Settings
        global_settings = get_global_notification_settings()
        quiet_hours_active = False
        if global_settings.get("quiet_hours_enabled", False):
            q_start = global_settings.get("quiet_hours_start", "22:00")
            q_end = global_settings.get("quiet_hours_end", "08:00")
            quiet_hours_active = is_in_quiet_hours(q_start, q_end)

        # 2. Fetch User Channel Preferences
        user_prefs = get_user_notification_preferences(user_id)

        # Filter enabled channels based on global & user toggles
        eligible_channels = []
        for ch in requested_channels:
            ch_upper = ch.upper()
            if ch_upper == "IN_APP":
                if global_settings.get("in_app_enabled", True) and user_prefs.get("in_app_enabled", True):
                    eligible_channels.append("IN_APP")
            elif ch_upper == "PUSH":
                if global_settings.get("push_enabled", True) and user_prefs.get("push_enabled", True):
                    eligible_channels.append("PUSH")
            elif ch_upper == "EMAIL":
                if global_settings.get("email_enabled", True) and user_prefs.get("email_enabled", True):
                    eligible_channels.append("EMAIL")

        # 3. Execute Delivery Policy
        if delivery_policy == "ORDERED_FALLBACK":
            # Primary: PUSH -> Fallback: IN_APP -> Fallback: EMAIL
            success = False
            priority_order = ["PUSH", "IN_APP", "EMAIL"]
            for ch in priority_order:
                if ch in eligible_channels:
                    if ch == "PUSH":
                        s, _ = await deliver_push(job_id, user_id, company_id, title, message, metadata, quiet_hours_active, quiet_hours_bypass)
                        if s: success = True; break
                    elif ch == "IN_APP":
                        s, _ = await deliver_in_app(job_id, user_id, company_id, title, message, notification_type, metadata)
                        if s: success = True; break
                    elif ch == "EMAIL":
                        s, _ = await deliver_email(job_id, user_id, company_id, title, message, metadata)
                        if s: success = True; break

            status = "COMPLETED" if success else "FAILED"
            update_job_status(job_id, status)
        else: # PARALLEL
            tasks = []
            if "IN_APP" in eligible_channels:
                tasks.append(deliver_in_app(job_id, user_id, company_id, title, message, notification_type, metadata))
            if "PUSH" in eligible_channels:
                tasks.append(deliver_push(job_id, user_id, company_id, title, message, metadata, quiet_hours_active, quiet_hours_bypass))
            if "EMAIL" in eligible_channels:
                tasks.append(deliver_email(job_id, user_id, company_id, title, message, metadata))

            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                any_sent = any(r[0] is True for r in results if isinstance(r, tuple))
                status = "COMPLETED" if any_sent else "FAILED"
            else:
                status = "COMPLETED" # No eligible channels active (suppressed)

            update_job_status(job_id, status)

# ==============================================================================
# PERIODIC CRON JOBS
# ==============================================================================

async def poll_notification_jobs(ctx: Optional[Dict[str, Any]] = None):
    """
    Cron Job 1: Runs every 10–30 seconds.
    Fetches pending notification jobs and processes them concurrently bounded by semaphore.
    """
    pending = fetch_pending_notification_jobs(limit=50)
    if not pending:
        return

    # Mark as PROCESSING
    for j in pending:
        update_job_status(j["id"], "PROCESSING")

    # Concurrent batch execution
    await asyncio.gather(*[execute_job(j) for j in pending], return_exceptions=True)

async def scan_workflow_schedules(ctx: Optional[Dict[str, Any]] = None):
    """
    Cron Job 2: Runs every 30 minutes.
    Scans at-risk streaks with batched pagination to schedule engagement alerts.
    """
    conn = get_pg_connection()
    if not conn:
        return

    batch_size = 100
    offset = 0
    today_str = datetime.now().strftime("%Y-%m-%d")

    try:
        while True:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT user_id, current_streak
                    FROM public.learner_metrics
                    WHERE current_streak > 0
                    ORDER BY user_id
                    LIMIT %s OFFSET %s
                """, (batch_size, offset))
                rows = cur.fetchall()
                if not rows:
                    break

                for r in rows:
                    uid, streak = r[0], r[1]
                    # Publish STREAK_AT_RISK trigger through EventBus
                    from utils.notifications.event_bus import EventBus
                    EventBus.publish_event(
                        event_name="STREAK_AT_RISK",
                        user_id=str(uid),
                        payload={"streak_days": streak}
                    )

                offset += batch_size
    except Exception as e:
        logger.error(f"Error scanning workflow schedules: {e}")
    finally:
        conn.close()

# ARQ Worker Settings
class WorkerSettings:
    functions = [execute_job]
    cron_jobs = [
        # Poll queue every 15 seconds
        {"coroutine": poll_notification_jobs, "second": {0, 15, 30, 45}},
        # Streak scanner every 30 minutes
        {"coroutine": scan_workflow_schedules, "minute": {0, 30}},
    ]
    redis_settings = RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    max_jobs = 20
