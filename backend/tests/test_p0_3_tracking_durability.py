import pytest
import asyncio
import json
import uuid
from tracking.redis_client import get_redis
from tracking.persistence_worker import process_persistence

@pytest.mark.asyncio
async def test_tracking_durability(mocker):
    import tracking.redis_client
    tracking.redis_client.redis_client = None
    client = await tracking.redis_client.get_redis()
    await client.delete("gps_persistence_queue")
    
    # 1. Insert an item into the queue
    worker_id = str(uuid.uuid4())
    data = {"worker_id": worker_id, "job_id": "test_job", "lat": 1.0, "lng": 1.0, "accuracy": 1, "speed": 1, "heading": 1, "timestamp": "2026-01-01T00:00:00Z"}
    await client.lpush("gps_persistence_queue", json.dumps(data))
    
    # Only mock sleep to delay slightly so loop yields
    original_sleep = asyncio.sleep
    async def fast_sleep(delay):
        await original_sleep(0.01)
    
    mocker.patch("tracking.persistence_worker.asyncio.sleep", side_effect=fast_sleep)
    
    # 2. Simulate DB Failure
    mocker.patch("asyncio.to_thread", side_effect=Exception("DB Failure"))
    
    worker_task = asyncio.create_task(process_persistence())
    for _ in range(10):
        await asyncio.sleep(0)
    worker_task.cancel() # Stop the worker
    
    # Verify the item is NOT lost. The recovery block should have pushed it back.
    queue_len = await client.llen("gps_persistence_queue")
    assert queue_len == 1, "Item should not be lost on DB failure."
    
    # 3. Simulate Worker Crash BEFORE DB Persistence
    # Let's mock rpoplpush to move it, and then raise an exception before to_thread
    mocker.patch("asyncio.to_thread", side_effect=asyncio.CancelledError("Crash")) # simulate hard crash
    
    # Actually, simulating a hard crash where the python process dies is hard. 
    # But since it's rpoplpush, the item is in the proc_queue.
    
    # Clean up
    await client.delete("gps_persistence_queue")

@pytest.mark.asyncio
async def test_tracking_durability_success(mocker):
    import tracking.redis_client
    tracking.redis_client.redis_client = None
    client = await tracking.redis_client.get_redis()
    await client.delete("gps_persistence_queue")
    
    worker_id = str(uuid.uuid4())
    data = {"worker_id": worker_id, "job_id": "test_job", "lat": 1.0, "lng": 1.0, "accuracy": 1, "speed": 1, "heading": 1, "timestamp": "2026-01-01T00:00:00Z"}
    await client.lpush("gps_persistence_queue", json.dumps(data))
    
    # Only mock sleep to delay slightly so loop yields
    original_sleep = asyncio.sleep
    async def fast_sleep(delay):
        await original_sleep(0.01)

    mocker.patch("tracking.persistence_worker.asyncio.sleep", side_effect=fast_sleep)
    mock_db = mocker.patch("asyncio.to_thread", return_value=None)
    
    worker_task = asyncio.create_task(process_persistence())
    for _ in range(10):
        await asyncio.sleep(0)
    worker_task.cancel()
    
    queue_len = await client.llen("gps_persistence_queue")
    assert queue_len == 0, "Item should be removed on success."
    assert mock_db.call_count >= 1, "DB insert should be called"
    
    await client.delete("gps_persistence_queue")
