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

@router.post("/location")
async def receive_location(payload: LocationUpdateSchema, request: Request):
    # Validate tracking session (Assume worker_id from auth, using a mock for now)
    worker_id = "mock_worker_id" # In real app, extract from JWT in Request
    
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
        # Mock destination coordinates for now, in a real app fetch job destination from DB
        dest_lat = 28.4595 # Example
        dest_lng = 77.0266
        
        await enqueue_eta_calculation(
            job_id=payload.job_id,
            worker_id=worker_id,
            current_lat=payload.latitude,
            current_lng=payload.longitude,
            dest_lat=dest_lat,
            dest_lng=dest_lng
        )
        await client.setex(last_eta_key, 3600, str(current_time))
    
    print(f"Received and broadcasted location for job {payload.job_id}: {payload.latitude}, {payload.longitude}")
    return {"message": "Location received"}

@router.get("/job/{job_id}")
async def get_tracking_state(job_id: str):
    # TODO: Fetch current state (active, ETA, etc.)
    return {"job_id": job_id, "status": "active", "eta": "TBD"}
