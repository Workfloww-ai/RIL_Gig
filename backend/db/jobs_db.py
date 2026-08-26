from utils.supabase_client import supabase
from fastapi import HTTPException, status
from typing import Dict, Any

def create_job_request(user_id: str, request_data: Dict[str, Any]):
    """
    Creates a new job request (manpower request) for a store manager.
    Validates that the user is an active store manager and extracts store_id.
    """
    # 1. Verify the user is an active store manager and get their store assignment
    assignment_response = supabase.table("user_store_assignment").select(
        "assignment_id, store_id"
    ).eq("user_id", user_id).single().execute()
    
    if not assignment_response.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not have an active store manager assignment."
        )
        
    store_assignment_id = assignment_response.data["assignment_id"]
    store_id = assignment_response.data["store_id"]
    
    # 2. Prepare the payload for manpower_requests
    payload = {
        "job_id": request_data["job_id"],
        "store_assignment_id": store_assignment_id,
        "store_id": store_id,
        "workers_needed": request_data["workers_needed"],
        # Ensure date and time are stringified (Pydantic model_dump handles this at router level usually)
        "shift_date": request_data["shift_date"],
        "start_time": request_data["start_time"],
        "hours_duration": request_data["hours_duration"],
        "approval_status": "pending"
    }
    
    # 3. Insert into manpower_requests table
    insert_response = supabase.table("manpower_requests").insert(payload).execute()
    
    if not insert_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create job request."
        )
        
    return insert_response.data[0]

def get_all_jobs():
    """
    Fetches all available jobs to populate the dropdown on the frontend.
    Avoids SELECT * per enterprise guidelines.
    """
    response = supabase.table("jobs").select("job_id, job_name, base_compensation").execute()
    return response.data

def get_recent_activity(user_id: str):
    """
    Fetches the recent completed jobs (activity) for a worker.
    """
    response = supabase.table("worker_job_assignments").select(
        "job_assignment_id, assignment_status, updated_at, manpower_requests(request_id, shift_date, hours_duration, jobs(job_name, base_compensation))"
    ).eq("worker_id", user_id).eq("assignment_status", "completed").order("updated_at", desc=True).limit(5).execute()
    
    activities = []
    for row in response.data:
        req = row.get("manpower_requests")
        if isinstance(req, list) and len(req) > 0:
            req = req[0]
        if not req:
            continue
            
        job = req.get("jobs")
        if isinstance(job, list) and len(job) > 0:
            job = job[0]
        if not job:
            continue
            
        hours = float(req.get("hours_duration", 0))
        rate = float(job.get("base_compensation", 0))
        amount = hours * rate
        
        activities.append({
            "id": row.get("job_assignment_id"),
            "job_name": job.get("job_name", "Unknown Job"),
            "shift_date": req.get("shift_date"),
            "hours": hours,
            "amount": amount,
            "updated_at": row.get("updated_at")
        })
    return activities
