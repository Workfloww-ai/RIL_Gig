import os
import json
import httpx
from datetime import datetime, timezone, timedelta
from .redis_client import get_redis
from typing import Optional

GOOGLE_MAPS_SERVER_KEY = os.getenv("GOOGLE_MAPS_SERVER_KEY")

async def calculate_eta_google(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> Optional[dict]:
    """
    Calls Google Routes API to get the traffic-aware ETA.
    """
    if not GOOGLE_MAPS_SERVER_KEY:
        print("[ETA Service] GOOGLE_MAPS_SERVER_KEY is missing!")
        return None

    # Using the newer Routes API v2
    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_SERVER_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
    }

    payload = {
        "origin": {
            "location": {
                "latLng": {
                    "latitude": origin_lat,
                    "longitude": origin_lng
                }
            }
        },
        "destination": {
            "location": {
                "latLng": {
                    "latitude": dest_lat,
                    "longitude": dest_lng
                }
            }
        },
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            if not data.get("routes"):
                return None
            
            route = data["routes"][0]
            distance_meters = route.get("distanceMeters", 0)
            duration_str = route.get("duration", "0s")
            polyline = route.get("polyline", {}).get("encodedPolyline", "")
            
            # Parse "780s" -> 780
            duration_seconds = int(duration_str.rstrip("s"))
            
            return {
                "distance_meters": distance_meters,
                "duration_seconds": duration_seconds,
                "polyline": polyline
            }
        except Exception as e:
            print(f"[ETA Service] Error calling Google Routes API: {e}")
            return None

async def enqueue_eta_calculation(job_id: str, worker_id: str, current_lat: float, current_lng: float, dest_lat: float, dest_lng: float):
    """
    Pushes an ETA calculation task to the Redis Queue.
    """
    client = await get_redis()
    payload = {
        "job_id": job_id,
        "worker_id": worker_id,
        "current_lat": current_lat,
        "current_lng": current_lng,
        "dest_lat": dest_lat,
        "dest_lng": dest_lng,
        "queued_at": datetime.now(timezone.utc).isoformat()
    }
    # Using a simple Redis List as a queue
    await client.lpush("eta_calculation_queue", json.dumps(payload))
    print(f"[ETA Service] Enqueued ETA calculation for job {job_id}")

async def determine_eta_status(scheduled_start_time: datetime, eta_timestamp: datetime) -> str:
    """
    Returns EARLY, ON_TIME, DELAYED, etc based on the ETA vs Scheduled time.
    Configurable thresholds could be loaded from env or db.
    """
    diff_minutes = (eta_timestamp - scheduled_start_time).total_seconds() / 60
    
    if diff_minutes < -15:
        return "EARLY"
    elif diff_minutes <= 10: # Up to 10 mins late is ON_TIME
        return "ON_TIME"
    elif diff_minutes <= 30:
        return "AT_RISK"
    else:
        return "DELAYED"
