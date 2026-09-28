import os
import json
import redis.asyncio as redis
from typing import Optional

redis_client: Optional[redis.Redis] = None

async def get_redis():
    global redis_client
    if redis_client is None:
        # User has upstash credentials like: redis-cli --tls -u redis://default:xxx@xxx.upstash.io:6379
        raw_url = os.getenv("UPSTASH_REDIS_REST_URL")
        if not raw_url:
            raise ValueError("UPSTASH_REDIS_REST_URL environment variable is not set")
            
        # Extract the actual URL part
        redis_url = raw_url
        if "-u " in raw_url:
            redis_url = raw_url.split("-u ")[1].strip()
            # Replace redis:// with rediss:// if it's TLS
            if "--tls" in raw_url and redis_url.startswith("redis://"):
                redis_url = redis_url.replace("redis://", "rediss://", 1)
                
        # Add connection parameters to prevent Upstash timeouts
        redis_client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_keepalive=True,
            health_check_interval=10,
            socket_connect_timeout=5,
            socket_timeout=30,
            retry_on_timeout=True,
            max_connections=100
        )
    return redis_client

async def update_worker_location(worker_id: str, job_id: str, lat: float, lng: float, accuracy: float, speed: float, heading: float, timestamp: str):
    """Stores the latest worker location in Redis with a TTL."""
    client = await get_redis()
    key = f"worker:{worker_id}:location"
    data = {
        "job_id": job_id,
        "lat": lat,
        "lng": lng,
        "accuracy": accuracy,
        "speed": speed,
        "heading": heading,
        "timestamp": timestamp
    }
    # Set with 120 seconds TTL (stale connection detection)
    await client.setex(key, 120, json.dumps(data))
    
    # Push to persistence queue (List) for bulk inserting into DB later
    await client.lpush("gps_persistence_queue", json.dumps({"worker_id": worker_id, **data}))
    
    # Also publish to a channel so WebSockets can pick it up and broadcast
    channel = f"job:{job_id}:location_updates"
    await client.publish(channel, json.dumps({"worker_id": worker_id, **data}))

async def get_worker_location(worker_id: str) -> Optional[dict]:
    client = await get_redis()
    key = f"worker:{worker_id}:location"
    data = await client.get(key)
    if data:
        return json.loads(data)
    return None
