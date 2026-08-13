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
    response = supabase.table("jobs").select("job_id, title, base_compensation").execute()
    return response.data
