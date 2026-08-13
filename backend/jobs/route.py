from fastapi import APIRouter, Depends, status
from typing import Dict, Any
from .schemas import JobRequestCreate, JobRequestResponse, JobResponse
from db.jobs_db import create_job_request, get_all_jobs
from utils.jwt_auth import get_current_user

router = APIRouter()

@router.get("/available", response_model=list[JobResponse])
async def fetch_available_job_roles(user_id: str = Depends(get_current_user)):
    """
    Fetches all available job roles for the dropdown.
    """
    jobs = get_all_jobs()
    return jobs

@router.post("/", response_model=JobRequestResponse, status_code=status.HTTP_201_CREATED)
async def raise_job_request(
    request: JobRequestCreate,
    user_id: str = Depends(get_current_user)
):
    """
    Endpoint for a store manager to raise a manpower request.
    The store_manager's user_id is extracted from the JWT token.
    """
    # Convert request to dict, ensuring date/time are stringified
    request_data = request.model_dump(mode='json')
    
    # Call the database function
    created_request = create_job_request(user_id=user_id, request_data=request_data)
    
    return created_request
