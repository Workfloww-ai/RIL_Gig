from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from .schemas import SuperadminRequestsResponse, SuperadminJobResponse, ActionResponse, RejectRequestPayload, DeclineReasonsResponse
from utils.supabase_client import supabase
from utils.jwt_auth import get_current_user
import datetime

router = APIRouter()

async def verify_superadmin(user_id: str = Depends(get_current_user)):
    try:
        user_res = supabase.table("users").select("role_id").eq("user_id", user_id).execute()
        if not user_res.data:
            raise HTTPException(status_code=403, detail="User not found")
            
        role_id = user_res.data[0].get("role_id")
        if not role_id:
            raise HTTPException(status_code=403, detail="Role not found for user")
            
        role_res = supabase.table("roles").select("role_name").eq("role_id", role_id).execute()
        if not role_res.data or role_res.data[0].get("role_name") != "superadmin":
            raise HTTPException(status_code=403, detail="Not authorized. Superadmin access required.")
            
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error verifying superadmin role: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during authorization")

@router.get("/decline-reasons", response_model=DeclineReasonsResponse)
async def get_decline_reasons(user_id: str = Depends(verify_superadmin)):
    """
    Fetch all active decline reasons from the database.
    """
    try:
        response = supabase.table("decline_reasons").select("id, reason_text").eq("is_active", True).order("created_at", desc=False).execute()
        return DeclineReasonsResponse(status="success", reasons=response.data)
    except Exception as e:
        print(f"Error fetching decline reasons: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch decline reasons")

@router.get("/requests", response_model=SuperadminRequestsResponse)
async def get_pending_requests(limit: int = 100, offset: int = 0, user_id: str = Depends(verify_superadmin)):
    """
    Fetch all manpower requests for superadmin across all stores.
    """
    try:
        response = supabase.table("manpower_requests").select(
            "request_id, workers_needed, shift_date, start_time, hours_duration, request_status, approval_status, decline_reason, "
            "jobs(job_id, job_name, base_compensation), "
            "stores(store_id, store_name, address, city)"
        ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        requests = []
        for r in response.data:
            job_info = r.get("jobs") or {}
            if isinstance(job_info, list) and len(job_info) > 0:
                job_info = job_info[0]
                
            store_info = r.get("stores") or {}
            if isinstance(store_info, list) and len(store_info) > 0:
                store_info = store_info[0]
            
            hours = float(r.get("hours_duration", 0))
            base_comp = float(job_info.get("base_compensation", 0)) / 100.0
                
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
                approval_status=r.get("approval_status", ""),
                decline_reason=r.get("decline_reason")
            ))
            
        return SuperadminRequestsResponse(status="success", requests=requests)
    except Exception as e:
        print(f"Error fetching superadmin requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/requests/{request_id}/approve", response_model=ActionResponse)
async def approve_request(request_id: str, user_id: str = Depends(verify_superadmin)):
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
async def reject_request(request_id: str, payload: RejectRequestPayload, user_id: str = Depends(verify_superadmin)):
    try:
        res = supabase.table("manpower_requests").update({
            "approval_status": "declined",
            "request_status": "closed",
            "decline_reason": payload.decline_reason
        }).eq("request_id", request_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Request not found")
            
        return ActionResponse(status="success", message="Job rejected.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from .schemas import StoresListResponse, StoreCreateRequest, StoreResponse

@router.get("/stores", response_model=StoresListResponse)
async def get_all_stores(user_id: str = Depends(verify_superadmin)):
    """
    Fetch all stores for superadmin.
    """
    try:
        # Fetch stores
        stores_res = supabase.table("stores").select("store_id, store_name, address, city, state, pincode, google_map_link, store_type").order("created_at", desc=True).execute()
                
        stores = []
        for s in stores_res.data:
            stores.append(StoreResponse(
                store_id=s.get("store_id"),
                store_name=s.get("store_name"),
                address=s.get("address"),
                city=s.get("city"),
                state=s.get("state"),
                pincode=s.get("pincode"),
                google_map_link=s.get("google_map_link"),
                store_type=s.get("store_type")
            ))
            
        return StoresListResponse(status="success", stores=stores)
    except Exception as e:
        print(f"Error fetching stores: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stores", response_model=ActionResponse)
async def create_store(request: StoreCreateRequest, user_id: str = Depends(verify_superadmin)):
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

from .schemas import ManagersListResponse, ManagerCreateRequest, ManagerResponse
from utils.email import send_welcome_email

from pydantic import BaseModel
class SuperadminStatsResponse(BaseModel):
    total_stores: int
    total_managers: int

@router.get("/stats", response_model=SuperadminStatsResponse)
async def get_superadmin_stats(user_id: str = Depends(verify_superadmin)):
    """
    Fetch high level statistics for the superadmin dashboard.
    """
    try:
        # Get total stores
        stores_res = supabase.table("stores").select("store_id", count="exact").execute()
        total_stores = stores_res.count if hasattr(stores_res, 'count') and stores_res.count is not None else len(stores_res.data)

        # Get total managers (store_manager or supervisor)
        roles_res = supabase.table("roles").select("role_id").in_("role_name", ["store_manager", "supervisor"]).execute()
        role_ids = [r["role_id"] for r in roles_res.data]
        
        total_managers = 0
        if role_ids:
            managers_res = supabase.table("users").select("user_id", count="exact").in_("role_id", role_ids).execute()
            total_managers = managers_res.count if hasattr(managers_res, 'count') and managers_res.count is not None else len(managers_res.data)

        return SuperadminStatsResponse(total_stores=total_stores, total_managers=total_managers)
    except Exception as e:
        print(f"Error fetching superadmin stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/managers", response_model=ManagersListResponse)
async def get_all_managers(user_id: str = Depends(verify_superadmin)):
    """
    Fetch all users with role 'store_manager' or 'supervisor'.
    """
    try:
        # Get role IDs
        roles_res = supabase.table("roles").select("role_id, role_name").in_("role_name", ["store_manager", "supervisor"]).execute()
        role_map = {r["role_id"]: r["role_name"] for r in roles_res.data}
        role_ids = list(role_map.keys())
        
        if not role_ids:
            return ManagersListResponse(status="success", managers=[])
            
        # Fetch users explicitly
        users_res = supabase.table("users").select("user_id, first_name, last_name, email, mobile_number, role_id, is_verified").in_("role_id", role_ids).order("created_at", desc=True).execute()
        
        # Fetch store assignments
        user_ids = [u["user_id"] for u in users_res.data]
        assignments_map = {}
        if user_ids:
            assign_res = supabase.table("user_store_assignment").select("user_id, stores(store_name)").in_("user_id", user_ids).execute()
            for a in assign_res.data:
                store_data = a.get("stores")
                if store_data:
                    # Could be list or dict based on relation setup
                    if isinstance(store_data, list) and len(store_data) > 0:
                        store_name = store_data[0].get("store_name")
                    else:
                        store_name = store_data.get("store_name")
                    assignments_map[a["user_id"]] = store_name

        managers = []
        for u in users_res.data:
            managers.append(ManagerResponse(
                user_id=u["user_id"],
                first_name=u["first_name"],
                last_name=u["last_name"],
                email=u.get("email"),
                mobile_number=u.get("mobile_number", ""),
                role_name=role_map.get(u["role_id"], "unknown").replace("_", " "),
                store_name=assignments_map.get(u["user_id"]),
                is_verified=u.get("is_verified", False)
            ))
            
        return ManagersListResponse(status="success", managers=managers)
    except Exception as e:
        print(f"Error fetching managers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/managers", response_model=ActionResponse)
async def create_manager(request: ManagerCreateRequest, user_id: str = Depends(verify_superadmin)):
    """
    Create a new store manager or supervisor.
    """
    try:
        # Validate role
        role_name_clean = request.role.lower().replace(" ", "_")
        if role_name_clean not in ["store_manager", "supervisor"]:
            raise HTTPException(status_code=400, detail="Invalid role. Must be 'store_manager' or 'supervisor'")
            
        role_res = supabase.table("roles").select("role_id").eq("role_name", role_name_clean).execute()
        if not role_res.data:
            raise HTTPException(status_code=500, detail=f"Role '{role_name_clean}' not found in database")
        role_id = role_res.data[0]["role_id"]
        
        mobile_num = request.mobile_number.strip()
        if mobile_num.startswith("+"):
            mobile_num = mobile_num[1:]
        if not mobile_num.startswith("91"):
            mobile_num = "91" + mobile_num

        # Insert user
        user_dict = {
            "first_name": request.first_name,
            "last_name": request.last_name,
            "email": request.email,
            "mobile_number": mobile_num,
            "address": request.address,
            "city": request.city,
            "state": request.state,
            "pincode": request.pincode,
            "role_id": role_id
        }
        
        user_res = supabase.table("users").insert(user_dict).execute()
        if not user_res.data:
            raise HTTPException(status_code=500, detail="Failed to create user")
            
        new_user_id = user_res.data[0]["user_id"]
        
        # Insert store assignment
        assign_res = supabase.table("user_store_assignment").insert({
            "user_id": new_user_id,
            "store_id": request.store_id
        }).execute()
        
        # Fetch store details for email
        store_res = supabase.table("stores").select("store_name, address, google_map_link").eq("store_id", request.store_id).execute()
        store_name = "Unknown Store"
        store_address = "Unknown Address"
        if store_res.data:
            store_name = store_res.data[0].get("store_name", store_name)
            store_address = store_res.data[0].get("address", store_address)
            
        # Send welcome email
        send_welcome_email(
            to_email=request.email,
            manager_name=f"{request.first_name} {request.last_name}",
            role=role_name_clean,
            store_name=store_name,
            store_address=store_address,
            google_map_link=store_res.data[0].get("google_map_link", "")
        )
        
        return ActionResponse(status="success", message=f"{role_name_clean.title()} created successfully")
    except Exception as e:
        print(f"Error creating manager: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


