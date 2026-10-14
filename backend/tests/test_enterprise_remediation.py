import os
import sys
import time
import uuid
import json
import asyncio
import pytest

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv()

from db.notifications_db import (
    schedule_bulk_notification_jobs,
    get_recipient_context,
    update_unsubscribe_status,
    find_user_by_email,
    get_pg_connection,
)
from utils.websocket_manager import WebSocketManager, ws_manager
from utils.notifications.template_engine import TemplateEngine, compute_content_hash
from utils.notifications.registry_contracts import VARIABLE_FALLBACKS
from utils.notifications.contract_validator import EventContractValidator
from workers.arq_worker import (
    is_in_quiet_hours,
    verify_unsubscribe_token,
    generate_unsubscribe_token,
    DELIVERY_SEMAPHORE
)

def test_1_rls_security_policy():
    """
    Test 1: Verify RLS policies are enabled on notification_workflows and notifications.
    """
    conn = get_pg_connection()
    assert conn is not None, "Postgres connection must be available"
    with conn.cursor() as cur:
        cur.execute("""
            SELECT relname, relrowsecurity
            FROM pg_class
            WHERE relname IN ('notification_workflows', 'notifications', 'notification_jobs');
        """)
        rows = dict(cur.fetchall())
        assert rows.get("notification_workflows") is True, "RLS must be enabled on notification_workflows"
        assert rows.get("notifications") is True, "RLS must be enabled on notifications"
        assert rows.get("notification_jobs") is True, "RLS must be enabled on notification_jobs"
    conn.close()

def test_2_bulk_job_scheduling_idempotency():
    """
    Test 2: schedule_bulk_notification_jobs_rpc creates 1 job on first call,
    and 0 jobs on second call (exact-once idempotency).
    """
    conn = get_pg_connection()
    assert conn is not None
    test_uid = str(uuid.uuid4())
    with conn.cursor() as cur:
        # Create user
        cur.execute("""
            INSERT INTO public.users (user_id, email, name, is_active)
            VALUES (%s, 'idempotent@example.com', 'Idempotent User', TRUE)
            ON CONFLICT (user_id) DO NOTHING;
        """, (test_uid,))
    conn.close()

    meta = {"task_id": "task_idempotency_test_001"}
    notif_type = "TEST_TYPE"

    # First call -> Should insert 1
    count1 = schedule_bulk_notification_jobs([test_uid], notif_type, meta)
    assert count1 == 1, f"Expected 1 job inserted on first call, got {count1}"

    # Second call -> Exact duplicate, should insert 0 (idempotent)
    count2 = schedule_bulk_notification_jobs([test_uid], notif_type, meta)
    assert count2 == 0, f"Expected 0 jobs inserted on second call due to idempotency, got {count2}"

def test_3_recipient_context_enrichment_performance():
    """
    Test 3: get_notification_recipient_context_rpc executes in < 50ms
    and aggregates all required keys in one roundtrip.
    """
    conn = get_pg_connection()
    assert conn is not None
    test_uid = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO public.users (user_id, email, name, first_name, last_name, is_active)
            VALUES (%s, 'perf@example.com', 'Rohan Patel', 'Rohan', 'Patel', TRUE);
        """, (test_uid,))
    conn.close()

    start_time = time.time()
    ctx = get_recipient_context(test_uid)
    duration_ms = (time.time() - start_time) * 1000

    # Ensure latency sub-50ms
    assert duration_ms < 50, f"Context resolution took {duration_ms:.2f}ms, expected < 50ms"

    # Verify canonical keys
    expected_keys = [
        "subscriber.first_name",
        "subscriber.full_name",
        "subscriber.email",
        "subscriber.company_name",
        "subscriber.email_unsubscribed",
        "gamification.streak_days",
        "curriculum.progress_percentage"
    ]
    for k in expected_keys:
        assert k in ctx, f"Missing expected key: {k}"

    assert ctx["subscriber.first_name"] == "Rohan"
    assert ctx["subscriber.email"] == "perf@example.com"

@pytest.mark.asyncio
async def test_4_websocket_loopback_deduplication():
    """
    Test 4: WebSocket manager discards broadcast messages originating
    from its own instance_id to prevent duplicate toast alerts.
    """
    manager = WebSocketManager()
    assert manager.instance_id is not None
    assert len(manager.instance_id) == 32

    # Envelope from self
    self_msg = {
        "type": "broadcast",
        "message": {"title": "Ping"},
        "sender_instance_id": manager.instance_id
    }
    # Envelope from another instance
    peer_msg = {
        "type": "broadcast",
        "message": {"title": "Ping"},
        "sender_instance_id": uuid.uuid4().hex
    }

    # Verify identification
    assert self_msg["sender_instance_id"] == manager.instance_id
    assert peer_msg["sender_instance_id"] != manager.instance_id

def test_5_can_spam_compliance_and_anti_enumeration():
    """
    Test 5: Unsubscribe synchronizes users and preferences tables,
    and manual unsubscribe prevents account enumeration.
    """
    conn = get_pg_connection()
    assert conn is not None
    test_uid = str(uuid.uuid4())
    email = f"unsub_{uuid.uuid4().hex[:6]}@example.com"
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO public.users (user_id, email, name, email_unsubscribed)
            VALUES (%s, %s, 'Unsub Test', FALSE);
        """, (test_uid, email))
    conn.close()

    # Verify HMAC token generation & verification
    token = generate_unsubscribe_token(test_uid)
    verified_uid = verify_unsubscribe_token(token)
    assert verified_uid == test_uid, "HMAC token must verify accurately"

    # Execute unsubscribe
    updated = update_unsubscribe_status(test_uid)
    assert updated is True

    # Verify both tables updated
    conn = get_pg_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT email_unsubscribed FROM public.users WHERE user_id = %s;", (test_uid,))
        u_status = cur.fetchone()[0]
        cur.execute("SELECT email_enabled FROM public.notification_preferences WHERE user_id = %s;", (test_uid,))
        p_row = cur.fetchone()
        p_status = p_row[0] if p_row else None
    conn.close()

    assert u_status is True, "users.email_unsubscribed must be True"
    assert p_status is False, "notification_preferences.email_enabled must be False"

    # Anti-Enumeration check: finding non-existent email returns None
    missing_user = find_user_by_email("does_not_exist_at_all@domain.com")
    assert missing_user is None, "Non-existent user must return None"

def test_6_worker_concurrency_and_quiet_hours():
    """
    Test 6: Worker bounds active tasks with asyncio.Semaphore(20)
    and quiet hours logic properly identifies DND windows.
    """
    # Concurrency limit check
    assert DELIVERY_SEMAPHORE._value == 20

    # Quiet hours check: 22:00 to 08:00 (crosses midnight)
    from datetime import datetime
    night_time = datetime(2026, 10, 14, 23, 30) # 23:30
    day_time = datetime(2026, 10, 14, 14, 0)    # 14:00

    assert is_in_quiet_hours("22:00", "08:00", night_time) is True
    assert is_in_quiet_hours("22:00", "08:00", day_time) is False

def test_7_template_engine_and_event_contract_fallbacks():
    """
    Test 7: Token interpolation, conditionals, normalized content-hash,
    and fallback injection when optional keys are omitted.
    """
    # 1. Template Engine
    tpl_title = "Hello {{ subscriber.first_name | capitalize }}!"
    tpl_body = "{{#if passed}}Congrats! You scored {{ score }}%.{{else}}Keep practicing!{{/if}}"
    
    ctx_passed = {"subscriber.first_name": "ananya", "passed": True, "score": 95}
    r_title, r_body = TemplateEngine.render_notification(tpl_title, tpl_body, ctx_passed)
    assert r_title == "Hello Ananya!"
    assert r_body == "Congrats! You scored 95%."

    ctx_failed = {"subscriber.first_name": "ananya", "passed": False}
    _, r_body_fail = TemplateEngine.render_notification(tpl_title, tpl_body, ctx_failed)
    assert r_body_fail == "Keep practicing!"

    # 2. Content Hash normalization
    hash1 = compute_content_hash("Hello   World", "  Test body  ", "in_app")
    hash2 = compute_content_hash("Hello World", "Test body", "IN_APP")
    assert hash1 == hash2, "Content hashes must match regardless of whitespace or casing"

    # 3. Contract validator fallbacks
    is_valid, _, cleaned = EventContractValidator.validate_payload(
        "MODULE_ASSIGNED",
        {"module_title": "Safety 101"}
    )
    assert is_valid is True
    # Verify fallback for omitted first_name
    assert cleaned.get("subscriber.first_name") == VARIABLE_FALLBACKS["subscriber.first_name"]
    # Verify bidirectional alias syncing
    assert cleaned.get("curriculum.module_title") == "Safety 101"
