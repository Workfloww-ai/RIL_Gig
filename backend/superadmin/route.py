from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from .schemas import SuperadminRequestsResponse, SuperadminJobResponse, ActionResponse
from utils.supabase_client import supabase
from utils.jwt_auth import get_current_user
import datetime

router = APIRouter()

@router.get("/requests", response_model=SuperadminRequestsResponse)
async def get_pending_requests(user_id: str = Depends(get_current_user)):
    """
    Fetch all pending manpower requests for superadmin across all stores.
    """
    try:
        response = supabase.table("manpower_requests").select(
            "request_id, workers_needed, shift_date, start_time, hours_duration, request_status, approval_status, "
            "jobs(job_id, job_name, base_compensation), "
            "stores(store_id, store_name, address, city)"
        ).eq("approval_status", "pending").execute()
        
        requests = []
        for r in response.data:
            job_info = r.get("jobs") or {}
            if isinstance(job_info, list) and len(job_info) > 0:
                job_info = job_info[0]
                
            store_info = r.get("stores") or {}
            if isinstance(store_info, list) and len(store_info) > 0:
                store_info = store_info[0]
            
            hours = float(r.get("hours_duration", 0))
            base_comp = float(job_info.get("base_compensation", 0))
                
            requests.append(SuperadminJobResponse(
                request_id=r.get("request_id", ""),
                job_name=job_info.get("job_name", ""),
                store_name=store_info.get("store_name", ""),
                address=store_info.get("address"),
                city=store_info.get("city"),
                shift_date=r.get("shift_date", ""),
                start_time=r.get("start_time", ""),
                workers_needed=r.get("workers_needed", 1),
                compensation=hours * base_comp,
                approval_status=r.get("approval_status", "")
            ))
            
        return SuperadminRequestsResponse(status="success", requests=requests)
    except Exception as e:
        print(f"Error fetching superadmin requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/requests/{request_id}/approve", response_model=ActionResponse)
async def approve_request(request_id: str, user_id: str = Depends(get_current_user)):
    try:
        # Check if the user is a superadmin in a real world app here
        res = supabase.table("manpower_requests").update({
            "approval_status": "approved",
            "request_status": "open"
        }).eq("request_id", request_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Request not found")
            
        return ActionResponse(status="success", message="Job approved and published live.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/requests/{request_id}/reject", response_model=ActionResponse)
async def reject_request(request_id: str, user_id: str = Depends(get_current_user)):
    try:
        res = supabase.table("manpower_requests").update({
            "approval_status": "declined",
            "request_status": "closed"
        }).eq("request_id", request_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Request not found")
            
        return ActionResponse(status="success", message="Job rejected.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from .schemas import StoresListResponse, StoreCreateRequest, StoreResponse

@router.get("/stores", response_model=StoresListResponse)
async def get_all_stores(user_id: str = Depends(get_current_user)):
    """
    Fetch all stores for superadmin.
    """
    try:
        # Fetch stores
        stores_res = supabase.table("stores").select("*").order("created_at", desc=True).execute()
                
        stores = []
        for s in stores_res.data:
            stores.append(StoreResponse(
                store_id=s.get("store_id"),
                store_name=s.get("store_name"),
                address=s.get("address"),
                city=s.get("city"),
                state=s.get("state"),
                pincode=s.get("pincode"),
                google_map_link=s.get("google_map_link")
            ))
            
        return StoresListResponse(status="success", stores=stores)
    except Exception as e:
        print(f"Error fetching stores: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stores", response_model=ActionResponse)
async def create_store(request: StoreCreateRequest, user_id: str = Depends(get_current_user)):
    """
    Create a new store.
    """
    try:
        payload = request.model_dump(mode='json', exclude_none=True)
        res = supabase.table("stores").insert(payload).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create store")
            
        return ActionResponse(status="success", message="Store created successfully")
    except Exception as e:
        print(f"Error creating store: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

