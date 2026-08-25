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
        "hours_duration": request_data["hours_duration"]
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

def get_pending_t90_call_assignments():
    """
    Fetches all worker_job_assignments with assignment_status='accepted'
    and t90_status='pending', joined with manpower_requests, stores, and worker profile.
    Explicitly mentions column names per enterprise guidelines.
    """
    response = supabase.table("worker_job_assignments").select(
        "job_assignment_id, request_id, store_id, worker_id, assignment_status, t90_status, "
        "manpower_requests(shift_date, start_time, jobs(job_name, base_compensation)), "
        "stores(store_name), "
        "users!fk_wja_worker(first_name, last_name, mobile_number)"
    ).eq("assignment_status", "accepted").eq("t90_status", "pending").execute()
    
    return response.data if response.data else []


def update_t90_call_status(job_assignment_id: str, new_status: str = "call_initiated"):
    """
    Updates the t90_status or call status of a worker job assignment after a Hunar voice call dispatch.
    """
    response = supabase.table("worker_job_assignments").update({
        "t90_status": new_status
    }).eq("job_assignment_id", job_assignment_id).execute()
    return response.data

