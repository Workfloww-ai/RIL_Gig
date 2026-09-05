from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from .schemas import JobRequestCreate, JobRequestResponse, JobResponse, JobRoleResponse, AvailableJobsResponse, AcceptJobResponse, MyAcceptedJobsResponse, AcceptedJobResponse, CompleteJobRequest
from db.jobs_db import create_job_request, get_all_jobs
from db.finance_db import create_payment_record
from utils.jwt_auth import get_current_user
from utils.supabase_client import supabase

router = APIRouter()

@router.get("/roles", response_model=list[JobRoleResponse])
async def fetch_available_job_roles(limit: int = 100, offset: int = 0, user_id: str = Depends(get_current_user)):
    """
    Fetches all available job roles for the dropdown.
    """
    jobs = get_all_jobs(limit=limit, offset=offset)
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

@router.get("/available", response_model=AvailableJobsResponse)
async def get_available_jobs(user_id: str = Depends(get_current_user)):
    try:
        # Fetch open requests and join jobs and stores
        response = supabase.table("manpower_requests").select(
            "request_id, workers_needed, shift_date, start_time, hours_duration, request_status, approval_status, "
            "jobs(job_id, job_name, base_compensation), "
            "stores(store_id, store_name, address, city, google_map_link)"
        ).eq("request_status", "open").execute()
        
        # Allow either 'approved' or 'confirmed'
        requests = [r for r in response.data if str(r.get("approval_status")).lower() in ("approved", "confirmed")]
        
        import datetime
        current_time = datetime.datetime.now()
        
        valid_requests = []
        for r in requests:
            shift_date_str = r.get("shift_date")
            start_time_str = r.get("start_time")
            
            if shift_date_str and start_time_str:
                try:
                    if len(start_time_str.split(':')) == 2:
                        start_time_str += ":00"
                    job_datetime_str = f"{shift_date_str} {start_time_str}"
                    job_datetime = datetime.datetime.strptime(job_datetime_str, "%Y-%m-%d %H:%M:%S")
                    
                    if job_datetime < current_time:
                        # Job is in the past, update its status to closed
                        supabase.table("manpower_requests").update({"request_status": "closed"}).eq("request_id", r["request_id"]).execute()
                        continue
                except Exception as e:
                    print(f"Error parsing date/time for request {r['request_id']}: {e}")
            
            valid_requests.append(r)
            
        requests = valid_requests
        
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
                city=store_info.get("city"),
                google_map_link=store_info.get("google_map_link")
            ))
            
        return AvailableJobsResponse(status="success", jobs=jobs)
    except Exception as e:
        print(f"Error fetching available jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

import datetime

@router.post("/accept/{request_id}", response_model=AcceptJobResponse)
async def accept_job(request_id: str, user_id: str = Depends(get_current_user)):
    try:
        # 1. Determine if we need to bypass checkpoints
        req_details = supabase.table("manpower_requests").select("shift_date, start_time").eq("request_id", request_id).execute()
        
        t90_status = "pending"
        t60_status = "pending"
        
        if req_details.data:
            rd = req_details.data[0]
            shift_date_str = rd.get("shift_date")
            start_time_str = rd.get("start_time")
            if shift_date_str and start_time_str:
                if len(start_time_str.split(':')) == 2:
                    start_time_str += ":00"
                try:
                    shift_dt = datetime.datetime.strptime(f"{shift_date_str} {start_time_str}", "%Y-%m-%d %H:%M:%S")
                    time_diff = shift_dt - datetime.datetime.now()
                    minutes_until_shift = time_diff.total_seconds() / 60.0
                    
                    if minutes_until_shift <= 90:
                        t90_status = "confirmed"
                    
                    if minutes_until_shift <= 60:
                        t60_status = "confirmed"
                except Exception as e:
                    print(f"Error parsing date for accept_job bypass: {e}")
        else:
            raise HTTPException(status_code=404, detail="Job not found")

        # 2. Call the atomic RPC to lock, check and insert
        rpc_response = supabase.rpc(
            "accept_job_atomic", 
            {
                "p_request_id": request_id,
                "p_worker_id": user_id,
                "p_t90_status": t90_status,
                "p_t60_status": t60_status
            }
        ).execute()

        result = rpc_response.data
        if not result.get("success"):
            status_code = result.get("status_code", 400)
            raise HTTPException(status_code=status_code, detail=result.get("message", "Failed to accept job"))
            
        return AcceptJobResponse(status="success", message="Job accepted successfully")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error accepting job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/cancel/{request_id}")
async def cancel_job(request_id: str, user_id: str = Depends(get_current_user)):
    try:
        # 1. Check if the job is accepted by this user
        existing = supabase.table("worker_job_assignments").select("job_assignment_id").eq("request_id", request_id).eq("worker_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=400, detail="You have not accepted this job")
            
        # 1.5 Check time restriction (cannot cancel < 100 minutes before start)
        req_res = supabase.table("manpower_requests").select("shift_date, start_time").eq("request_id", request_id).execute()
        if req_res.data:
            from datetime import datetime
            shift_date = req_res.data[0].get("shift_date")
            start_time = req_res.data[0].get("start_time")
            if shift_date and start_time:
                shift_datetime = datetime.strptime(f"{shift_date} {start_time}", "%Y-%m-%d %H:%M:%S")
                diff = shift_datetime - datetime.now()
                if diff.total_seconds() > 0 and diff.total_seconds() < 5400:
                    raise HTTPException(status_code=400, detail="Cannot cancel job less than 90 minutes before start time")
                    
        # 2. Delete the assignment
        supabase.table("worker_job_assignments").delete().eq("request_id", request_id).eq("worker_id", user_id).execute()
        
        # 3. Update the manpower request status back to 'open'
        supabase.table("manpower_requests").update({"request_status": "open"}).eq("request_id", request_id).execute()
        
        return {"status": "success", "message": "Job successfully cancelled"}
    except Exception as e:
        print(f"Error cancelling job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/accepted", response_model=MyAcceptedJobsResponse)
async def get_accepted_jobs(user_id: str = Depends(get_current_user)):
    try:
        response = supabase.table("worker_job_assignments").select(
            "assignment_status, t90_status, t60_status, arrival_status, rating_score, rating_tags, rating_feedback, manpower_requests(request_id, shift_date, start_time, hours_duration, jobs(job_id, job_name, base_compensation), stores(store_id, store_name, address, city, google_map_link))"
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
                city=store_info.get("city"),
                google_map_link=store_info.get("google_map_link"),
                t90_status=r.get("t90_status", "pending"),
                t60_status=r.get("t60_status", "pending"),
                arrival_status=r.get("arrival_status", "pending"),
                rating_score=r.get("rating_score"),
                rating_tags=r.get("rating_tags"),
                rating_feedback=r.get("rating_feedback")
            ))
            
        return MyAcceptedJobsResponse(status="success", jobs=jobs)
    except Exception as e:
        print(f"Error fetching accepted jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
class ConfirmJobRequest(BaseModel):
    step: str # 't90', 't60', or 'arrival'

@router.post("/confirm/{request_id}")
async def confirm_job_step(request_id: str, payload: ConfirmJobRequest, user_id: str = Depends(get_current_user)):
    try:
        step = payload.step
        if step not in ['t90', 't60', 'arrival']:
            raise HTTPException(status_code=400, detail="Invalid step")
            
        # Check if the job is accepted by this user
        existing = supabase.table("worker_job_assignments").select("job_assignment_id").eq("request_id", request_id).eq("worker_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=400, detail="You have not accepted this job")
            
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        update_data = {}
        if step == 't90':
            update_data = {"t90_status": "confirmed", "t90_accepted_at": now_iso}
        elif step == 't60':
            update_data = {"t60_status": "confirmed", "t60_accepted_at": now_iso}
        elif step == 'arrival':
            update_data = {"arrival_status": "arrived", "arrival_accepted_at": now_iso}
            
        supabase.table("worker_job_assignments").update(update_data).eq("request_id", request_id).eq("worker_id", user_id).execute()
        
        return {"status": "success", "message": f"Job step {step} confirmed"}
    except Exception as e:
        print(f"Error confirming job step: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/manager/requests")
async def get_manager_requests(user_id: str = Depends(get_current_user)):
    try:
        # First find the store_assignment for this manager
        assignment = supabase.table("user_store_assignment").select("store_id, stores(store_name)").eq("user_id", user_id).execute()
        if not assignment.data:
            return {"status": "success", "requests": [], "store_name": None}
            
        store_id = assignment.data[0]["store_id"]
        store_name = None
        store_info = assignment.data[0].get("stores")
        if store_info:
            if isinstance(store_info, list) and len(store_info) > 0:
                store_name = store_info[0].get("store_name")
            elif isinstance(store_info, dict):
                store_name = store_info.get("store_name")
        
        # Now fetch requests for this store
        response = supabase.table("manpower_requests").select(
            "request_id, workers_needed, shift_date, start_time, hours_duration, request_status, approval_status, decline_reason, "
            "jobs(job_id, job_name, base_compensation), "
            "stores(store_id, store_name, address, city), "
            "worker_job_assignments(job_assignment_id, worker_id, assignment_status, t90_status, t60_status, arrival_status, rating_score, rating_tags, rating_feedback, users!fk_wja_worker(first_name, last_name))"
        ).eq("store_id", store_id).order("created_at", desc=True).execute()
        
        requests = []
        for r in response.data:
            job_info = r.get("jobs") or {}
            if isinstance(job_info, list) and len(job_info) > 0:
                job_info = job_info[0]
            
            store_info = r.get("stores") or {}
            if isinstance(store_info, list) and len(store_info) > 0:
                store_info = store_info[0]
                
            raw_workers = r.get("worker_job_assignments") or []
            accepted_workers = []
            for w in raw_workers:
                user_info = w.get("users") or {}
                # The profile_pic_url might not exist, default to None
                # avatar_url = user_info.get("profile_pic_url")
                name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or "Unknown Worker"
                accepted_workers.append({
                    "id": w.get("worker_id"),
                    "assignment_id": w.get("job_assignment_id"),
                    "name": name,
                    "status": w.get("assignment_status"),
                    "t90_status": w.get("t90_status", "pending") or "pending",
                    "t60_status": w.get("t60_status", "pending") or "pending",
                    "arrival_status": w.get("arrival_status", "pending") or "pending",
                    "role": job_info.get("job_name", ""),
                    "rating": {
                        "score": w.get("rating_score") or 0,
                        "tags": w.get("rating_tags") or [],
                        "feedback": w.get("rating_feedback") or ""
                    } if w.get("rating_score") else None
                })
            
            print(f"[Debug] Worker assignments for request {r.get('request_id')}: {accepted_workers}")
                
            requests.append({
                "request_id": r.get("request_id", ""),
                "workers_needed": r.get("workers_needed", 1),
                "workers_filled": len([w for w in accepted_workers if w["status"] in ["accepted", "completed"]]),
                "shift_date": r.get("shift_date", ""),
                "start_time": r.get("start_time", ""),
                "hours_duration": float(r.get("hours_duration", 0)),
                "request_status": r.get("request_status", ""),
                "approval_status": r.get("approval_status", ""),
                "decline_reason": r.get("decline_reason", ""),
                "job_id": job_info.get("job_id", ""),
                "job_name": job_info.get("job_name", ""),
                "base_compensation": float(job_info.get("base_compensation", 0)),
                "store_id": store_info.get("store_id", ""),
                "store_name": store_info.get("store_name", ""),
                "accepted_workers": accepted_workers
            })
            
        return {"status": "success", "requests": requests, "store_name": store_name}
    except Exception as e:
        print(f"Error fetching manager requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class CancelReasonRequest(BaseModel):
    cancellation_reason: str = ""

@router.post("/manager/jobs/assignment/{assignment_id}/cancel_and_replace")
async def manager_cancel_and_replace(
    assignment_id: str,
    payload: CancelReasonRequest,
    user_id: str = Depends(get_current_user)
):
    try:
        # First verify user is manager of this store
        # For brevity assuming get_current_user handles general auth, but we should strictly check store manager auth
        assignment_resp = supabase.table("worker_job_assignments").select("request_id, store_id").eq("job_assignment_id", assignment_id).execute()
        if not assignment_resp.data:
            raise HTTPException(status_code=404, detail="Assignment not found")
            
        request_id = assignment_resp.data[0]["request_id"]
        job_store_id = assignment_resp.data[0]["store_id"]
        
        # Verify store manager authorization
        user_resp = supabase.table("users").select("role_id").eq("user_id", user_id).execute()
        if user_resp.data and user_resp.data[0].get("role_id"):
            role_resp = supabase.table("roles").select("role_name").eq("role_id", user_resp.data[0]["role_id"]).execute()
            if role_resp.data and "manager" in role_resp.data[0].get("role_name", "").lower():
                store_assignment = supabase.table("user_store_assignment").select("store_id").eq("user_id", user_id).execute()
                if not store_assignment.data or str(store_assignment.data[0]["store_id"]) != str(job_store_id):
                    raise HTTPException(status_code=403, detail="You are not authorized to manage jobs for this store")

        
        # 1. Cancel the assignment
        supabase.table("worker_job_assignments").update({
            "assignment_status": "cancelled",
            "cancellation_reason": payload.cancellation_reason,
            "t90_status": "cancelled",
            "t60_status": "cancelled",
            "arrival_status": "cancelled"
        }).eq("job_assignment_id", assignment_id).execute()
        
        # 2. Re-open the manpower request to find replacement
        supabase.table("manpower_requests").update({"request_status": "open"}).eq("request_id", request_id).execute()
        
        return {"status": "success", "message": "Worker cancelled and shift re-opened for urgent replacement."}
    except Exception as e:
        print(f"Error in cancel_and_replace: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

import random
import string

class VerifyOtpRequest(BaseModel):
    otp_code: str
    worker_id: str

@router.post("/accept/{request_id}/start-otp")
async def generate_start_otp(request_id: str, user_id: str = Depends(get_current_user)):
    try:
        # Check if the job is accepted by this user
        existing = supabase.table("worker_job_assignments").select("job_assignment_id, arrival_status, assignment_status").eq("request_id", request_id).eq("worker_id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=400, detail="You have not accepted this job")
            
        assignment = existing.data[0]
        if assignment.get("assignment_status") != "accepted":
            raise HTTPException(status_code=400, detail="Job is not in a valid state to generate OTP")
            
        # Check if shift time has started
        req_res = supabase.table("manpower_requests").select("shift_date, start_time").eq("request_id", request_id).execute()
        if req_res.data:
            rd = req_res.data[0]
            shift_date = rd.get("shift_date")
            start_time = rd.get("start_time")
            if shift_date and start_time:
                from datetime import datetime, timedelta
                if len(start_time.split(':')) == 2:
                    start_time += ":00"
                try:
                    shift_datetime = datetime.strptime(f"{shift_date} {start_time}", "%Y-%m-%d %H:%M:%S")
                    if datetime.now() < shift_datetime - timedelta(minutes=10):
                        raise HTTPException(status_code=400, detail="Cannot generate OTP more than 10 minutes before shift")
                    if datetime.now() > shift_datetime:
                        supabase.table("worker_job_assignments").update({
                            "assignment_status": "no_show"
                        }).eq("job_assignment_id", assignment.get("job_assignment_id")).execute()
                        raise HTTPException(status_code=400, detail="Shift start time has already passed. Marked as No Show.")
                except Exception as e:
                    print(f"Error parsing date in start-otp: {e}")

        otp_code = ''.join(random.choices(string.digits, k=4))
        
        # Check if OTP already exists
        existing_otp = supabase.table("job_start_otps").select("id").eq("request_id", request_id).eq("worker_id", user_id).execute()
        
        if existing_otp.data:
            supabase.table("job_start_otps").update({"otp_code": otp_code, "is_verified": False}).eq("id", existing_otp.data[0]["id"]).execute()
        else:
            supabase.table("job_start_otps").insert({
                "request_id": request_id,
                "worker_id": user_id,
                "otp_code": otp_code,
                "is_verified": False
            }).execute()
            
        return {"status": "success", "otp_code": otp_code}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating OTP: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/manager/jobs/assignment/{assignment_id}/verify-otp")
async def verify_start_otp(assignment_id: str, payload: VerifyOtpRequest, user_id: str = Depends(get_current_user)):
    try:
        assignment_resp = supabase.table("worker_job_assignments").select("request_id, store_id").eq("job_assignment_id", assignment_id).execute()
        if not assignment_resp.data:
            raise HTTPException(status_code=404, detail="Assignment not found")
            
        request_id = assignment_resp.data[0]["request_id"]
        job_store_id = assignment_resp.data[0]["store_id"]
        
        # Verify store manager authorization
        user_resp = supabase.table("users").select("role_id").eq("user_id", user_id).execute()
        if user_resp.data and user_resp.data[0].get("role_id"):
            role_resp = supabase.table("roles").select("role_name").eq("role_id", user_resp.data[0]["role_id"]).execute()
            if role_resp.data and "manager" in role_resp.data[0].get("role_name", "").lower():
                store_assignment = supabase.table("user_store_assignment").select("store_id").eq("user_id", user_id).execute()
                if not store_assignment.data or str(store_assignment.data[0]["store_id"]) != str(job_store_id):
                    raise HTTPException(status_code=403, detail="You are not authorized to manage jobs for this store")
        
        # Validate time limit before verifying
        req_res = supabase.table("manpower_requests").select("shift_date, start_time").eq("request_id", request_id).execute()
        if req_res.data:
            rd = req_res.data[0]
            shift_date = rd.get("shift_date")
            start_time = rd.get("start_time")
            if shift_date and start_time:
                from datetime import datetime
                if len(start_time.split(':')) == 2:
                    start_time += ":00"
                try:
                    shift_datetime = datetime.strptime(f"{shift_date} {start_time}", "%Y-%m-%d %H:%M:%S")
                    if datetime.now() > shift_datetime:
                        supabase.table("worker_job_assignments").update({
                            "assignment_status": "no_show"
                        }).eq("job_assignment_id", assignment_id).execute()
                        raise HTTPException(status_code=400, detail="Job start time has passed. Worker marked as No Show.")
                except Exception as e:
                    print(f"Error parsing date in verify-otp: {e}")

        otp_resp = supabase.table("job_start_otps").select("id, otp_code, is_verified").eq("request_id", request_id).eq("worker_id", payload.worker_id).execute()
        
        if not otp_resp.data:
            raise HTTPException(status_code=400, detail="No OTP requested for this job")
            
        if otp_resp.data[0]["is_verified"]:
            raise HTTPException(status_code=400, detail="OTP already verified")
            
        if otp_resp.data[0]["otp_code"] != payload.otp_code:
            raise HTTPException(status_code=400, detail="Invalid OTP code")
            
        supabase.table("job_start_otps").update({"is_verified": True}).eq("id", otp_resp.data[0]["id"]).execute()
        
        supabase.table("worker_job_assignments").update({
            "assignment_status": "started"
        }).eq("job_assignment_id", assignment_id).execute()
        
        return {"status": "success", "message": "Job started successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error verifying OTP: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/manager/jobs/assignment/{assignment_id}/complete")
async def manager_complete_job(
    assignment_id: str,
    payload: CompleteJobRequest,
    user_id: str = Depends(get_current_user)
):
    try:
        from datetime import datetime, timezone
        
        # Verify assignment exists
        assignment_resp = supabase.table("worker_job_assignments").select("request_id, store_id, assignment_status, worker_id").eq("job_assignment_id", assignment_id).execute()
        if not assignment_resp.data:
            raise HTTPException(status_code=404, detail="Assignment not found")
            
        job_store_id = assignment_resp.data[0]["store_id"]
        
        # Verify store manager authorization
        user_resp = supabase.table("users").select("role_id").eq("user_id", user_id).execute()
        if user_resp.data and user_resp.data[0].get("role_id"):
            role_resp = supabase.table("roles").select("role_name").eq("role_id", user_resp.data[0]["role_id"]).execute()
            if role_resp.data and "manager" in role_resp.data[0].get("role_name", "").lower():
                store_assignment = supabase.table("user_store_assignment").select("store_id").eq("user_id", user_id).execute()
                if not store_assignment.data or str(store_assignment.data[0]["store_id"]) != str(job_store_id):
                    raise HTTPException(status_code=403, detail="You are not authorized to manage jobs for this store")
                    
        if assignment_resp.data[0].get("assignment_status") != "started":
            raise HTTPException(status_code=400, detail="Only started shifts can be completed and rated")
            
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Update assignment to completed and save rating
        supabase.table("worker_job_assignments").update({
            "assignment_status": "completed",
            "rating_score": payload.rating_score,
            "rating_tags": payload.rating_tags,
            "rating_feedback": payload.rating_feedback,
            "rated_by": user_id,
            "rated_at": now_iso
        }).eq("job_assignment_id", assignment_id).execute()
        
        worker_id = assignment_resp.data[0].get("worker_id")
        request_id = assignment_resp.data[0].get("request_id")
        
        # Recalculate average rating and shifts completed
        if worker_id:
            ratings_resp = supabase.table("worker_job_assignments").select("rating_score").eq("worker_id", worker_id).not_.is_("rating_score", "null").execute()
            if ratings_resp.data:
                total_score = sum([r.get("rating_score", 0) for r in ratings_resp.data])
                num_rated_shifts = len(ratings_resp.data)
                avg_score = round(total_score / num_rated_shifts)
                supabase.table("users").update({
                    "ratings": avg_score,
                    "shifts_completed": num_rated_shifts
                }).eq("user_id", worker_id).execute()
                
            # Create payment record
            req_resp = supabase.table("manpower_requests").select("hours_duration, job_id").eq("request_id", request_id).execute()
            if req_resp.data:
                hours = req_resp.data[0].get("hours_duration", 0)
                job_id = req_resp.data[0].get("job_id")
                
                job_resp = supabase.table("jobs").select("base_compensation").eq("job_id", job_id).execute()
                base_comp_paise = job_resp.data[0].get("base_compensation", 0) if job_resp.data else 0
                
                from decimal import Decimal, ROUND_HALF_UP
                hours_dec = Decimal(str(hours))
                base_comp_dec = Decimal(str(base_comp_paise))
                
                amount = float((hours_dec * base_comp_dec).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
                
                user_res = supabase.table("users").select("upi_id").eq("user_id", worker_id).execute()
                upi_id = user_res.data[0].get("upi_id") if user_res.data else None
                
                create_payment_record(
                    job_assignment_id=assignment_id,
                    worker_id=worker_id,
                    amount=amount,
                    upi_id=upi_id
                )
        
        return {"status": "success", "message": "Shift completed and rating saved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error completing job assignment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

