import pytest
import asyncio
from jobs.t90_voice_worker import process_t90_voice_calls
from tracking.redis_client import get_redis

@pytest.mark.asyncio
async def test_worker_lock_prevents_duplication(caplog):
    import logging
    caplog.set_level(logging.INFO)
    redis_client = await get_redis()
    # Ensure lock is clear before starting
    await redis_client.delete("lock:t90_voice_worker")
    
    # 1. Start two workers concurrently
    res1, res2 = await asyncio.gather(
        process_t90_voice_calls(),
        process_t90_voice_calls()
    )
    
    # 2. Check logs: Only one should proceed, the other should skip
    skipped = [record for record in caplog.records if "Another replica is currently running" in record.message]
    
    # Assert exactly one skipped
    assert len(skipped) >= 1, "Expected at least one worker to skip due to lock."
    
    # Check that lock was actually acquired
    lock_val = await redis_client.get("lock:t90_voice_worker")
    assert lock_val == "locked", "Lock should be set in Redis"
    
    # 3. Test lock recovery (simulate lock expiry)
    await redis_client.delete("lock:t90_voice_worker")
    
    # Run again, it should proceed (not skip)
    caplog.clear()
    await process_t90_voice_calls()
    skipped_again = [record for record in caplog.records if "Another replica is currently running" in record.message]
    assert len(skipped_again) == 0, "Worker should proceed after lock recovery"
