import asyncio
import json
from datetime import datetime, timezone, timedelta
from .redis_client import get_redis
from .eta_service import calculate_eta_google, determine_eta_status
from .websocket import manager

async def process_eta_queue():
    """
    Continuously polls the Redis queue for ETA calculation tasks.
    """
    client = await get_redis()
    print("[ETA Worker] Started ETA Queue consumer.")
    
    while True:
        try:
            # Upstash drops idle connections silently, so BRPOP can hang indefinitely.
            # Using LPOP with a short sleep is safer for serverless Redis.
            payload_str = await client.lpop("eta_calculation_queue")
            
            if not payload_str:
                await asyncio.sleep(1)
                continue
                
            payload = json.loads(payload_str)
            
            job_id = payload["job_id"]
            worker_id = payload["worker_id"]
            current_lat = payload["current_lat"]
            current_lng = payload["current_lng"]
            dest_lat = payload["dest_lat"]
            dest_lng = payload["dest_lng"]
            
            print(f"[ETA Worker] Processing ETA for job {job_id}")
            
            # Call Google Routes API
            eta_data = await calculate_eta_google(
                origin_lat=current_lat, 
                origin_lng=current_lng, 
                dest_lat=dest_lat, 
                dest_lng=dest_lng
            )
            
            if eta_data:
                duration_seconds = eta_data["duration_seconds"]
                distance_meters = eta_data["distance_meters"]
                polyline = eta_data.get("polyline", "")
                
                now = datetime.now(timezone.utc)
                eta_timestamp = now + timedelta(seconds=duration_seconds)
                
                # Mock scheduled start time for now, in a real app fetch from DB or Redis
                scheduled_start_time = now + timedelta(minutes=15) 
                
                status = await determine_eta_status(scheduled_start_time, eta_timestamp)
                
                eta_result = {
                    "type": "eta_update",
                    "job_id": job_id,
                    "worker_id": worker_id,
                    "eta_minutes": duration_seconds // 60,
                    "distance_meters": distance_meters,
                    "status": status,
                    "eta_timestamp": eta_timestamp.isoformat(),
                    "calculated_at": now.isoformat(),
                    "polyline": polyline
                }
                
                # Publish ETA update to WebSockets
                await manager.broadcast(job_id, eta_result)
                
                # Also save the latest ETA to Redis
                eta_key = f"job:{job_id}:latest_eta"
                await client.setex(eta_key, 600, json.dumps(eta_result))
                
                # Note: A background process (Phase 9) should occasionally persist this to Supabase
                print(f"[ETA Worker] Broadcasted new ETA for job {job_id}: {status} ({duration_seconds // 60} mins)")
                
        except asyncio.CancelledError:
            print("[ETA Worker] Stopping consumer...")
            break
        except Exception as e:
            print(f"[ETA Worker] Error processing ETA queue: {e}")
            await asyncio.sleep(1) # Prevent tight loop on error
