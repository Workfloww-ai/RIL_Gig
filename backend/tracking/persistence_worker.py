import asyncio
import json
import time
from .redis_client import get_redis
from utils.supabase_client import supabase

async def process_persistence():
    """
    Background worker that occasionally snapshots hot Redis state into Supabase.
    """
    client = await get_redis()
    print("[Persistence Worker] Started.")
    
    while True:
        try:
            # Run every 60 seconds
            await asyncio.sleep(60)
            
            # Find all active worker locations
            keys = await client.keys("worker:*:location")
            if not keys:
                continue
                
            locations_to_persist = []
            
            for key in keys:
                data_str = await client.get(key)
                if not data_str:
                    continue
                
                data = json.loads(data_str)
                worker_id = key.split(":")[1]
                
                request_id = data["job_id"]
                real_job_id = request_id
                try:
                    # The mobile app passes request_id as 'job_id', but the DB expects the real job type ID
                    req_resp = supabase.table("manpower_requests").select("job_id").eq("request_id", request_id).execute()
                    if req_resp.data:
                        real_job_id = req_resp.data[0].get("job_id")
                except Exception as e:
                    pass
                
                locations_to_persist.append({
                    "worker_id": worker_id,
                    "job_id": real_job_id,
                    "latitude": data["lat"],
                    "longitude": data["lng"],
                    "accuracy": data["accuracy"],
                    "speed": data["speed"],
                    "heading": data["heading"],
                    "recorded_at": data["timestamp"]
                })
                
            if locations_to_persist:
                # Use asyncio.to_thread because supabase python client is synchronous
                from db.tracking_db import persist_worker_locations
                await asyncio.to_thread(persist_worker_locations, locations_to_persist)
                
                print(f"[Persistence Worker] Persisted {len(locations_to_persist)} locations to Supabase.")
                
        except asyncio.CancelledError:
            print("[Persistence Worker] Stopping...")
            break
        except Exception as e:
            print(f"[Persistence Worker] Error during persistence: {e}")
