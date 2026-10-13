import pytest
import asyncio
from unittest.mock import patch, MagicMock
from jobs.t90_voice_worker import process_t90_voice_calls


@pytest.mark.asyncio
async def test_db_claim_prevents_duplication(caplog):
    """
    Tests that the DB-level atomic claim prevents duplicate T90 voice calls
    when multiple replicas try to process the same assignment concurrently.
    """
    import logging
    caplog.set_level(logging.INFO)

    # Mock claim_t90_assignment to simulate race: first call claims, second doesn't
    call_count = {"n": 0}
    def mock_claim(assignment_id):
        call_count["n"] += 1
        # Only the first caller wins
        return call_count["n"] == 1

    with patch("jobs.t90_voice_worker.claim_t90_assignment", side_effect=mock_claim):
        with patch("jobs.t90_voice_worker.get_pending_t90_call_assignments") as mock_get:
            import datetime
            IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
            now = datetime.datetime.now(IST)
            # Create a shift that starts ~95 mins from now (inside the 89-100 min window)
            shift_dt = now + datetime.timedelta(minutes=95)
            mock_get.return_value = [{
                "job_assignment_id": "test-assignment-1",
                "manpower_requests": {
                    "shift_date": shift_dt.strftime("%Y-%m-%d"),
                    "start_time": shift_dt.strftime("%H:%M:%S"),
                    "jobs": {"job_name": "Test Job", "base_compensation": 500}
                },
                "stores": {"store_name": "Test Store"},
                "users": {"first_name": "Test", "mobile_number": "9876543210"}
            }]

            with patch("jobs.t90_voice_worker.trigger_t90_voice_call", return_value={"status": "ok"}):
                # Run two workers concurrently against the same assignment
                await asyncio.gather(
                    process_t90_voice_calls(),
                    process_t90_voice_calls()
                )

    # Verify that at least one replica was skipped due to DB claim failure
    skipped = [r for r in caplog.records if "already claimed by another replica" in r.message]
    assert len(skipped) >= 1, "Expected at least one worker to skip due to DB claim"


@pytest.mark.asyncio
async def test_claim_allows_processing_when_pending(caplog):
    """
    Tests that a single replica can successfully claim and process a pending assignment.
    """
    import logging
    caplog.set_level(logging.INFO)

    with patch("jobs.t90_voice_worker.claim_t90_assignment", return_value=True):
        with patch("jobs.t90_voice_worker.get_pending_t90_call_assignments") as mock_get:
            import datetime
            IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
            now = datetime.datetime.now(IST)
            shift_dt = now + datetime.timedelta(minutes=95)
            mock_get.return_value = [{
                "job_assignment_id": "test-assignment-2",
                "manpower_requests": {
                    "shift_date": shift_dt.strftime("%Y-%m-%d"),
                    "start_time": shift_dt.strftime("%H:%M:%S"),
                    "jobs": {"job_name": "Test Job", "base_compensation": 500}
                },
                "stores": {"store_name": "Test Store"},
                "users": {"first_name": "Worker", "mobile_number": "9876543210"}
            }]

            with patch("jobs.t90_voice_worker.trigger_t90_voice_call", return_value={"status": "ok"}) as mock_trigger:
                await process_t90_voice_calls()

    # Verify the call was triggered (not skipped)
    skipped = [r for r in caplog.records if "already claimed by another replica" in r.message]
    assert len(skipped) == 0, "Worker should proceed when claim is successful"
    mock_trigger.assert_called_once()
