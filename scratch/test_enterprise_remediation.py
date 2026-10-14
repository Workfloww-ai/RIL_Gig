# scratch/test_enterprise_remediation.py
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from tests.test_enterprise_remediation import (
    test_1_rls_security_policy,
    test_2_bulk_job_scheduling_idempotency,
    test_3_recipient_context_enrichment_performance,
    test_4_websocket_loopback_deduplication,
    test_5_can_spam_compliance_and_anti_enumeration,
    test_6_worker_concurrency_and_quiet_hours,
    test_7_template_engine_and_event_contract_fallbacks,
)

if __name__ == "__main__":
    import asyncio
    print("Running 7-step enterprise remediation test suite...")
    test_1_rls_security_policy()
    print("✓ Test 1: RLS security policies verified.")
    test_2_bulk_job_scheduling_idempotency()
    print("✓ Test 2: Bulk job exact-once idempotency verified.")
    test_3_recipient_context_enrichment_performance()
    print("✓ Test 3: Sub-50ms context enrichment verified.")
    asyncio.run(test_4_websocket_loopback_deduplication())
    print("✓ Test 4: WebSocket loopback deduplication verified.")
    test_5_can_spam_compliance_and_anti_enumeration()
    print("✓ Test 5: CAN-SPAM compliance & anti-enumeration verified.")
    test_6_worker_concurrency_and_quiet_hours()
    print("✓ Test 6: Worker concurrency & quiet hours verified.")
    test_7_template_engine_and_event_contract_fallbacks()
    print("✓ Test 7: Template engine & contract fallbacks verified.")
    print("\nALL 7 ENTERPRISE TESTS PASSED SUCCESSFULLY (0 ERRORS)!")
