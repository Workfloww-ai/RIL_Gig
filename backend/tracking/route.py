from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class LocationUpdateSchema(BaseModel):
    job_id: str
    latitude: float
    longitude: float
    accuracy: float
    speed: float
    heading: float
    timestamp: str

class StartTrackingSchema(BaseModel):
    job_id: str

@router.post("/session/start")
async def start_tracking_session(payload: StartTrackingSchema, request: Request):
    # TODO: Authenticate user, validate job assignment, start session in Supabase
    return {"message": "Tracking session started", "job_id": payload.job_id}

@router.post("/session/stop")
async def stop_tracking_session(payload: StartTrackingSchema, request: Request):
    # TODO: Authenticate user, end session in Supabase
    return {"message": "Tracking session stopped", "job_id": payload.job_id}

from .redis_client import update_worker_location, get_redis
from .eta_service import enqueue_eta_calculation
import time
import json

from utils.jwt_auth import get_current_user
from fastapi import Depends

@router.post("/location")
async def receive_location(
    payload: LocationUpdateSchema, 
    request: Request,
    worker_id: str = Depends(get_current_user)
):
    print(f"==================================================")
    print(f"[Backend] HIT /api/tracking/location FROM MOBILE!")
    print(f"[Backend] Worker: {worker_id}, Job: {payload.job_id}")
    print(f"==================================================")
    
    from utils.supabase_client import supabase
    try:
        wja_resp = supabase.table("worker_job_assignments").select("assignment_status, arrival_status, manpower_requests(shift_date, start_time)").eq("request_id", payload.job_id).eq("worker_id", worker_id).execute()
        if wja_resp.data and len(wja_resp.data) > 0:
            status = wja_resp.data[0].get("assignment_status")
            arrival_status = wja_resp.data[0].get("arrival_status")
            req_info = wja_resp.data[0].get("manpower_requests") or {}
            
            if isinstance(req_info, list) and len(req_info) > 0:
                req_info = req_info[0]

            if status != "accepted":
                print(f"[Backend] Job {payload.job_id} is no longer accepted (status: {status}). Telling mobile to STOP.")
                return {"message": "Stop tracking", "stop": True}
                
            # Check if shift has already started and worker has not shown up
            shift_date = req_info.get("shift_date")
            start_time = req_info.get("start_time")
            if shift_date and start_time and arrival_status != "arrived":
                from datetime import datetime, timezone, timedelta
                IST = timezone(timedelta(hours=5, minutes=30))
                now = datetime.now(IST)
                
                if len(start_time.split(':')) == 2:
                    start_time += ":00"
                    
                shift_dt_str = f"{shift_date} {start_time}"
                try:
                    shift_dt = datetime.strptime(shift_dt_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
                    if now >= shift_dt:
                        print(f"[Backend] Shift started at {shift_dt}, but worker arrival_status is '{arrival_status}'. Telling mobile to STOP.")
                        return {"message": "Stop tracking", "stop": True}
                except Exception as ex:
                    print(f"[Tracking] Error parsing shift time: {ex}")
        else:
            # Worker is NOT assigned to this job (or job was deleted)!
            print(f"[Backend] Worker {worker_id} has no active assignment for Job {payload.job_id}. Telling mobile to STOP.")
            return {"message": "Stop tracking", "stop": True}
    except Exception as e:
        print(f"[Tracking] Error checking assignment status: {e}")
    
    # Push to Redis for realtime broadcast
    await update_worker_location(
        worker_id=worker_id,
        job_id=payload.job_id,
        lat=payload.latitude,
        lng=payload.longitude,
        accuracy=payload.accuracy,
        speed=payload.speed,
        heading=payload.heading,
        timestamp=payload.timestamp
    )
    
    # ETA Decision Engine: Check when we last calculated ETA
    client = await get_redis()
    last_eta_key = f"job:{payload.job_id}:last_eta_calc_time"
    last_calc_time_str = await client.get(last_eta_key)
    
    current_time = time.time()
    should_recalculate = False
    
    if not last_calc_time_str:
        should_recalculate = True
    else:
        last_calc_time = float(last_calc_time_str)
        # Recalculate every 1 second for testing purposes (normally 60s to save API costs)
        if current_time - last_calc_time > 1:
            should_recalculate = True
            
    if should_recalculate:
        dest_lat = None
        dest_lng = None
        
        try:
            from utils.supabase_client import supabase
            # payload.job_id is actually the request_id from manpower_requests
            req_resp = supabase.table("manpower_requests").select("store_id").eq("request_id", payload.job_id).execute()
            if req_resp.data and len(req_resp.data) > 0:
                store_id = req_resp.data[0].get("store_id")
                if store_id:
                    store_resp = supabase.table("stores").select("latitude, longitude").eq("store_id", store_id).execute()
                    if store_resp.data and len(store_resp.data) > 0:
                        dest_lat = store_resp.data[0].get("latitude")
                        dest_lng = store_resp.data[0].get("longitude")
        except Exception as e:
            print(f"[Tracking] Error fetching real store destination: {e}")
            
        if dest_lat is not None and dest_lng is not None:
            await enqueue_eta_calculation(
                job_id=payload.job_id,
                worker_id=worker_id,
                current_lat=payload.latitude,
                current_lng=payload.longitude,
                dest_lat=dest_lat,
                dest_lng=dest_lng
            )
            await client.setex(last_eta_key, 3600, str(current_time))
        else:
            print(f"[Tracking] Warning: Could not find destination coordinates for job {payload.job_id}. Skipping ETA calculation.")
    
    print(f"Received and broadcasted location for job {payload.job_id}: {payload.latitude}, {payload.longitude}")
    return {"message": "Location received"}

@router.get("/job/{job_id}")
async def get_tracking_state(job_id: str):
    # TODO: Fetch current state (active, ETA, etc.)
    return {"job_id": job_id, "status": "active", "eta": "TBD"}
