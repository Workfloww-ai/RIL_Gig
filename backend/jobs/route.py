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
from fastapi import APIRouter, HTTPException, Depends
from utils.jwt_auth import get_current_user
from utils.supabase_client import supabase
from .schemas import AvailableJobsResponse, JobResponse, AcceptJobResponse, MyAcceptedJobsResponse, AcceptedJobResponse

router = APIRouter()

@router.get("/available", response_model=AvailableJobsResponse)
async def get_available_jobs(user_id: str = Depends(get_current_user)):
    try:
        # Fetch open requests and join jobs and stores
        response = supabase.table("manpower_requests").select(
            "request_id, workers_needed, shift_date, start_time, hours_duration, request_status, approval_status, "
            "jobs(job_id, job_name, base_compensation), "
            "stores(store_id, store_name, address, city)"
        ).eq("request_status", "open").execute()
        
        # Allow either 'approved' or 'confirmed'
        requests = [r for r in response.data if str(r.get("approval_status")).lower() in ("approved", "confirmed")]
        
        # Get user's currently accepted jobs to filter them out
        assignments = supabase.table("worker_job_assignments").select("request_id").eq("worker_id", user_id).execute()
        accepted_ids = {a["request_id"] for a in assignments.data}
        
        jobs = []
        for r in requests:
            if r["request_id"] in accepted_ids:
                continue
                
            job_info = r.get("jobs") or {}
            # If for some reason job_info is a list (depending on relationship), get first item
            if isinstance(job_info, list) and len(job_info) > 0:
                job_info = job_info[0]
                
            store_info = r.get("stores") or {}
            if isinstance(store_info, list) and len(store_info) > 0:
                store_info = store_info[0]
            
            jobs.append(JobResponse(
                request_id=r.get("request_id", ""),
                workers_needed=r.get("workers_needed", 1),
                shift_date=r.get("shift_date", ""),
                start_time=r.get("start_time", ""),
                hours_duration=float(r.get("hours_duration", 0)),
                request_status=r.get("request_status", ""),
                job_id=job_info.get("job_id", ""),
                job_name=job_info.get("job_name", ""),
                base_compensation=float(job_info.get("base_compensation", 0)),
                store_id=store_info.get("store_id", ""),
                store_name=store_info.get("store_name", ""),
                address=store_info.get("address"),
                city=store_info.get("city")
            ))
            
        return AvailableJobsResponse(status="success", jobs=jobs)
    except Exception as e:
        print(f"Error fetching available jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/accept/{request_id}", response_model=AcceptJobResponse)
async def accept_job(request_id: str, user_id: str = Depends(get_current_user)):
    try:
        # 1. Check if already accepted
        existing = supabase.table("worker_job_assignments").select("job_assignment_id").eq("request_id", request_id).eq("worker_id", user_id).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="You have already accepted this job")

        # 2. Get request details
        req_resp = supabase.table("manpower_requests").select("workers_needed, request_status, store_id").eq("request_id", request_id).execute()
        if not req_resp.data:
            raise HTTPException(status_code=404, detail="Job not found")
            
        req = req_resp.data[0]
        if req.get("request_status") != "open":
            raise HTTPException(status_code=400, detail="This job is no longer available")
            
        workers_needed = req.get("workers_needed", 1)
        store_id = req.get("store_id")
        
        # 3. Check current accepted count
        assignments = supabase.table("worker_job_assignments").select("job_assignment_id", count="exact").eq("request_id", request_id).execute()
        # Supabase python client count might be in assignments.count
        current_count = assignments.count if hasattr(assignments, 'count') and assignments.count is not None else len(assignments.data)
        
        if current_count >= workers_needed:
            # Auto close it just in case
            supabase.table("manpower_requests").update({"request_status": "closed"}).eq("request_id", request_id).execute()
            raise HTTPException(status_code=400, detail="Job has already been filled")
            
        # 4. Insert assignment
        supabase.table("worker_job_assignments").insert({
            "request_id": request_id,
            "store_id": store_id,
            "worker_id": user_id,
            "assignment_status": "accepted"
        }).execute()
        
        # 5. Check if it's filled now
        if current_count + 1 >= workers_needed:
            supabase.table("manpower_requests").update({"request_status": "closed"}).eq("request_id", request_id).execute()
            
        return AcceptJobResponse(status="success", message="Job accepted successfully")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error accepting job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/accepted", response_model=MyAcceptedJobsResponse)
async def get_accepted_jobs(user_id: str = Depends(get_current_user)):
    try:
        response = supabase.table("worker_job_assignments").select(
            "assignment_status, manpower_requests(request_id, shift_date, start_time, hours_duration, jobs(job_id, job_name, base_compensation), stores(store_id, store_name, address, city))"
        ).eq("worker_id", user_id).execute()
        
        jobs = []
        for r in response.data:
            req_info = r.get("manpower_requests")
            if not req_info:
                continue
            if isinstance(req_info, list) and len(req_info) > 0:
                req_info = req_info[0]
                
            job_info = req_info.get("jobs") or {}
            if isinstance(job_info, list) and len(job_info) > 0:
                job_info = job_info[0]
                
            store_info = req_info.get("stores") or {}
            if isinstance(store_info, list) and len(store_info) > 0:
                store_info = store_info[0]
                
            jobs.append(AcceptedJobResponse(
                assignment_status=r.get("assignment_status", ""),
                request_id=req_info.get("request_id", ""),
                shift_date=req_info.get("shift_date", ""),
                start_time=req_info.get("start_time", ""),
                hours_duration=float(req_info.get("hours_duration", 0)),
                job_id=job_info.get("job_id", ""),
                job_name=job_info.get("job_name", ""),
                base_compensation=float(job_info.get("base_compensation", 0)),
                store_id=store_info.get("store_id", ""),
                store_name=store_info.get("store_name", ""),
                address=store_info.get("address"),
                city=store_info.get("city")
            ))
            
        return MyAcceptedJobsResponse(status="success", jobs=jobs)
    except Exception as e:
        print(f"Error fetching accepted jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
