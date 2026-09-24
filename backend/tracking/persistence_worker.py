import asyncio
import json
import time
from .redis_client import get_redis
from utils.supabase_client import supabase

# Local in-memory cache to avoid repeated DB lookups for request_id -> job_id
request_id_to_job_id_cache = {}

async def process_persistence():
    """
    Background worker that occasionally flushes the GPS persistence queue into Supabase.
    """
    client = await get_redis()
    print("[Persistence Worker] Started Batch Queue consumer.")
    
    while True:
        try:
            # Run every 5 minutes (300 seconds) in production, but we'll use 60s for testing
            await asyncio.sleep(60)
            
            # Pop up to 10,000 items from the queue atomically
            # (In older redis we loop, in Redis 6.2+ we can use LPOP with count)
            items = []
            while len(items) < 10000:
                item = await client.rpop("gps_persistence_queue")
                if not item:
                    break
                items.append(item)
                
            if not items:
                continue
                
            locations_to_persist = []
            unknown_request_ids = set()
            
            # Parse all items
            parsed_items = [json.loads(item) for item in items]
            
            # Find missing mappings
            for data in parsed_items:
                req_id = data.get("job_id")
                if req_id and req_id not in request_id_to_job_id_cache:
                    unknown_request_ids.add(req_id)
            
            # Resolve missing mappings in ONE bulk query if needed
            if unknown_request_ids:
                try:
                    # Supabase 'in_' filter for bulk lookups
                    req_list = list(unknown_request_ids)
                    req_resp = supabase.table("manpower_requests").select("request_id, job_id").in_("request_id", req_list).execute()
                    if req_resp.data:
                        for row in req_resp.data:
                            request_id_to_job_id_cache[row["request_id"]] = row["job_id"]
                except Exception as e:
                    print(f"[Persistence Worker] Error bulk resolving job_ids: {e}")
            
            # Build the final persistence array
            for data in parsed_items:
                req_id = data.get("job_id")
                real_job_id = request_id_to_job_id_cache.get(req_id, req_id)
                
                locations_to_persist.append({
                    "worker_id": data["worker_id"],
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
                
                print(f"[Persistence Worker] Bulk Persisted {len(locations_to_persist)} queued GPS points to Supabase.")
                
        except asyncio.CancelledError:
            print("[Persistence Worker] Stopping...")
            break
        except Exception as e:
            print(f"[Persistence Worker] Error during persistence: {e}")
