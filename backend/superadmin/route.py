from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from .schemas import SuperadminRequestsResponse, SuperadminJobResponse, ActionResponse, RejectRequestPayload, DeclineReasonsResponse
from utils.supabase_client import supabase
from utils.jwt_auth import get_current_user
import datetime

router = APIRouter()

async def verify_superadmin(user_id: str = Depends(get_current_user)):
    try:
        user_res = supabase.table("users").select("role_id, tenant_id").eq("user_id", user_id).execute()
        if not user_res.data:
            raise HTTPException(status_code=403, detail="User not found")
            
        role_id = user_res.data[0].get("role_id")
        tenant_id = user_res.data[0].get("tenant_id")
        if not role_id:
            raise HTTPException(status_code=403, detail="Role not found for user")
            
        role_res = supabase.table("roles").select("role_name").eq("role_id", role_id).execute()
        if not role_res.data or role_res.data[0].get("role_name") not in ["superadmin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized. Superadmin or Admin access required.")
            
        role_name = role_res.data[0].get("role_name")
        is_global = (role_name == "superadmin")
        
        if not is_global and not tenant_id:
            raise HTTPException(status_code=403, detail="Admin must be assigned to a tenant.")
            
        return {"user_id": user_id, "role_name": role_name, "tenant_id": tenant_id, "is_global": is_global}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error verifying superadmin role: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during authorization")

from pydantic import BaseModel

class OrgResponse(BaseModel):
    organization_id: str
    name: str

class OrgListResponse(BaseModel):
    status: str
    organizations: List[OrgResponse]

class TenantResponse(BaseModel):
    tenant_id: str
    tenant_name: str

class TenantListResponse(BaseModel):
    status: str
    tenants: List[TenantResponse]

@router.get("/organizations", response_model=OrgListResponse)
async def get_organizations(admin_info: dict = Depends(verify_superadmin)):
    if not admin_info.get("is_global"):
        raise HTTPException(status_code=403, detail="Global superadmin access required to view organizations")
    try:
        res = supabase.table("organizations").select("organization_id, name").order("name", desc=False).execute()
        return OrgListResponse(status="success", organizations=res.data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/organizations/{org_id}/tenants", response_model=TenantListResponse)
async def get_tenants(org_id: str, admin_info: dict = Depends(verify_superadmin)):
    if not admin_info.get("is_global"):
        raise HTTPException(status_code=403, detail="Global superadmin access required to view tenants")
    try:
        res = supabase.table("tenants").select("tenant_id, tenant_name").eq("organization_id", org_id).order("tenant_name", desc=False).execute()
        return TenantListResponse(status="success", tenants=res.data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/decline-reasons", response_model=DeclineReasonsResponse)
async def get_decline_reasons(admin_info: dict = Depends(verify_superadmin)):
    """
    Fetch all active decline reasons from the database.
    """
    try:
        response = supabase.table("decline_reasons").select("id, reason_text").eq("is_active", True).order("created_at", desc=False).execute()
        return DeclineReasonsResponse(status="success", reasons=response.data)
    except Exception as e:
        print(f"Error fetching decline reasons: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch decline reasons")

from typing import Optional

@router.get("/requests", response_model=SuperadminRequestsResponse)
async def get_pending_requests(
    limit: int = 20, 
    offset: int = 0, 
    organization_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    admin_info: dict = Depends(verify_superadmin)
):
    """
    Fetch all manpower requests. Filters globally if superadmin, else scoped to admin's tenant.
    """
    try:
        is_global = admin_info.get("is_global")
        my_tenant_id = admin_info.get("tenant_id")
        
        target_tenant_ids = []
        if not is_global:
            if not my_tenant_id:
                raise HTTPException(status_code=403, detail="Admin is not assigned to a tenant.")
            target_tenant_ids = [my_tenant_id]
        else:
            if tenant_id:
                target_tenant_ids = [tenant_id]
            elif organization_id:
                tenants_res = supabase.table("tenants").select("tenant_id").eq("organization_id", organization_id).execute()
                target_tenant_ids = [t["tenant_id"] for t in tenants_res.data]
            else:
                return SuperadminRequestsResponse(status="success", requests=[], counts={"pending": 0, "approved": 0, "declined": 0}, has_more=False)
                
        if not target_tenant_ids:
             return SuperadminRequestsResponse(status="success", requests=[], counts={"pending": 0, "approved": 0, "declined": 0}, has_more=False)
            
        base_select = (
            "request_id, workers_needed, shift_date, start_time, hours_duration, request_status, approval_status, decline_reason, "
            "jobs(job_id, job_name, base_compensation), "
            "stores!inner(store_id, store_name, address, city, tenant_id)"
        )
        
        pending_resp = supabase.table("manpower_requests").select(base_select)\
            .in_("stores.tenant_id", target_tenant_ids)\
            .eq("approval_status", "pending")\
            .order("shift_date", desc=False).order("start_time", desc=False)\
            .range(offset, offset + limit - 1).execute()
            
        approved_resp = supabase.table("manpower_requests").select(base_select)\
            .in_("stores.tenant_id", target_tenant_ids)\
            .in_("approval_status", ["approved", "confirmed"])\
            .order("shift_date", desc=False).order("start_time", desc=False)\
            .range(offset, offset + limit - 1).execute()
            
        declined_resp = supabase.table("manpower_requests").select(base_select)\
            .in_("stores.tenant_id", target_tenant_ids)\
            .in_("approval_status", ["declined", "rejected"])\
            .order("shift_date", desc=False).order("start_time", desc=False)\
            .range(offset, offset + limit - 1).execute()
            
        all_data = []
        has_more = False
        
        if pending_resp.data:
            all_data.extend(pending_resp.data)
            if len(pending_resp.data) == limit: has_more = True
            
        if approved_resp.data:
            all_data.extend(approved_resp.data)
            if len(approved_resp.data) == limit: has_more = True
            
        if declined_resp.data:
            all_data.extend(declined_resp.data)
            if len(declined_resp.data) == limit: has_more = True
        
        requests = []
        for r in all_data:
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
                hours_duration=hours,
                compensation=hours * base_comp * r.get("workers_needed", 1),
                approval_status=r.get("approval_status", ""),
                decline_reason=r.get("decline_reason")
            ))
            
        pending_res = supabase.table("manpower_requests").select("request_id, stores!inner(tenant_id)").eq("approval_status", "pending").in_("stores.tenant_id", target_tenant_ids).execute()
        approved_res = supabase.table("manpower_requests").select("request_id, stores!inner(tenant_id)").in_("approval_status", ["approved", "confirmed"]).in_("stores.tenant_id", target_tenant_ids).execute()
        declined_res = supabase.table("manpower_requests").select("request_id, stores!inner(tenant_id)").in_("approval_status", ["declined", "rejected"]).in_("stores.tenant_id", target_tenant_ids).execute()
        
        counts = {
            "pending": len(pending_res.data) if pending_res.data else 0,
            "approved": len(approved_res.data) if approved_res.data else 0,
            "declined": len(declined_res.data) if declined_res.data else 0
        }
            
        return SuperadminRequestsResponse(status="success", requests=requests, counts=counts, has_more=has_more)
    except Exception as e:
        print(f"Error fetching superadmin requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/requests/{request_id}/approve", response_model=ActionResponse)
async def approve_request(request_id: str, admin_info: dict = Depends(verify_superadmin)):
    try:
        is_global = admin_info.get("is_global")
        if not is_global:
            tenant_id = admin_info.get("tenant_id")
            # Verify the request belongs to a store in this tenant before approving
            req_verify = supabase.table("manpower_requests").select("stores!inner(tenant_id)").eq("request_id", request_id).eq("stores.tenant_id", tenant_id).execute()
            if not req_verify.data:
                raise HTTPException(status_code=403, detail="Request not found or not in your tenant")
            
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
async def reject_request(request_id: str, payload: RejectRequestPayload, admin_info: dict = Depends(verify_superadmin)):
    try:
        is_global = admin_info.get("is_global")
        if not is_global:
            tenant_id = admin_info.get("tenant_id")
            # Verify the request belongs to a store in this tenant before rejecting
            req_verify = supabase.table("manpower_requests").select("stores!inner(tenant_id)").eq("request_id", request_id).eq("stores.tenant_id", tenant_id).execute()
            if not req_verify.data:
                raise HTTPException(status_code=403, detail="Request not found or not in your tenant")
            
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
async def get_all_stores(
    organization_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    admin_info: dict = Depends(verify_superadmin)
):
    """
    Fetch all stores.
    """
    try:
        is_global = admin_info.get("is_global")
        my_tenant_id = admin_info.get("tenant_id")
        
        target_tenant_ids = []
        if not is_global:
            target_tenant_ids = [my_tenant_id]
        else:
            if tenant_id:
                target_tenant_ids = [tenant_id]
            elif organization_id:
                tenants_res = supabase.table("tenants").select("tenant_id").eq("organization_id", organization_id).execute()
                target_tenant_ids = [t["tenant_id"] for t in tenants_res.data]
            else:
                return StoresListResponse(status="success", stores=[])
                
        if not target_tenant_ids:
            return StoresListResponse(status="success", stores=[])
        
        # Fetch stores
        stores_res = supabase.table("stores").select("store_id, store_name, address, city, state, pincode, google_map_link, contact_number, store_type, tenant_id").in_("tenant_id", target_tenant_ids).order("created_at", desc=True).execute()
                
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
                contact_number=s.get("contact_number"),
                store_type=s.get("store_type"),
                tenant_id=s.get("tenant_id")
            ))
            
        return StoresListResponse(status="success", stores=stores)
    except Exception as e:
        print(f"Error fetching stores: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stores", response_model=ActionResponse)
async def create_store(request: StoreCreateRequest, admin_info: dict = Depends(verify_superadmin)):
    """
    Create a new store.
    """
    try:
        is_global = admin_info.get("is_global")
        my_tenant_id = admin_info.get("tenant_id")
        
        if is_global:
            target_tenant_id = request.tenant_id
            if not target_tenant_id:
                raise HTTPException(status_code=400, detail="tenant_id is required for superadmin")
        else:
            target_tenant_id = my_tenant_id
            
        payload = request.model_dump(mode='json', exclude_none=True)
        payload["tenant_id"] = target_tenant_id
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
from typing import List, Optional

class OrgStat(BaseModel):
    organization_name: str
    tenant_name: str
    total_stores: int
    total_managers: int
    pending_requests: int

class SuperadminStatsResponse(BaseModel):
    total_stores: int
    total_managers: int
    pending_requests: int = 0
    approved_requests: int = 0
    declined_requests: int = 0
    organization_breakdown: List[OrgStat] = []

@router.get("/stats", response_model=SuperadminStatsResponse)
async def get_superadmin_stats(
    organization_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    admin_info: dict = Depends(verify_superadmin)
):
    """
    Fetch high level statistics for the superadmin dashboard.
    """
    try:
        is_global = admin_info.get("is_global")
        my_tenant_id = admin_info.get("tenant_id")
        
        target_tenant_ids = []
        if not is_global:
            target_tenant_ids = [my_tenant_id]
        else:
            if tenant_id:
                target_tenant_ids = [tenant_id]
            elif organization_id:
                tenants_res = supabase.table("tenants").select("tenant_id").eq("organization_id", organization_id).execute()
                target_tenant_ids = [t["tenant_id"] for t in tenants_res.data]
            else:
                tenants_all = supabase.table("tenants").select("tenant_id").execute()
                target_tenant_ids = [t["tenant_id"] for t in tenants_all.data]
                
        if not target_tenant_ids:
            return SuperadminStatsResponse(total_stores=0, total_managers=0)
        
        # Get total stores
        stores_res = supabase.table("stores").select("store_id", count="exact").in_("tenant_id", target_tenant_ids).execute()
        total_stores = stores_res.count if hasattr(stores_res, 'count') and stores_res.count is not None else len(stores_res.data)

        # Get total managers (store_manager or supervisor)
        roles_res = supabase.table("roles").select("role_id").in_("role_name", ["store_manager", "supervisor"]).execute()
        role_ids = [r["role_id"] for r in roles_res.data]
        
        # Find which managers belong to this tenant's stores
        assign_res = supabase.table("user_store_assignment").select("user_id, stores!inner(tenant_id)").in_("stores.tenant_id", target_tenant_ids).execute()
        user_ids = [a["user_id"] for a in assign_res.data]
        
        total_managers = 0
        if role_ids and user_ids:
            managers_res = supabase.table("users").select("user_id", count="exact").in_("role_id", role_ids).in_("user_id", user_ids).execute()
            total_managers = managers_res.count if hasattr(managers_res, 'count') and managers_res.count is not None else len(managers_res.data)

        # Get requests stats
        reqs_res = supabase.table("manpower_requests").select("request_id, approval_status, stores!inner(tenant_id)").in_("stores.tenant_id", target_tenant_ids).execute()
        pending_requests = 0
        approved_requests = 0
        declined_requests = 0
        if reqs_res.data:
            for req in reqs_res.data:
                status = req.get("approval_status")
                if status == "pending":
                    pending_requests += 1
                elif status in ["approved", "confirmed"]:
                    approved_requests += 1
                elif status in ["declined", "rejected"]:
                    declined_requests += 1
                    
        # Optional: Organization Breakdown (Only makes sense if they are Global and see multiple)
        org_breakdown = []
        if is_global:
            # We fetch all tenants and organizations they have access to
            tenants_list = supabase.table("tenants").select("tenant_id, tenant_name, organization_id, organizations(name)").in_("tenant_id", target_tenant_ids).execute()
            
            # For each tenant, calculate its specific stats
            if tenants_list.data:
                # Group stores by tenant
                tenant_stores = {}
                stores_all = supabase.table("stores").select("store_id, tenant_id").in_("tenant_id", target_tenant_ids).execute()
                for s in (stores_all.data or []):
                    tid = s["tenant_id"]
                    tenant_stores[tid] = tenant_stores.get(tid, 0) + 1
                    
                # Group managers by tenant
                tenant_managers = {}
                # Role filtering is already done by role_ids
                if role_ids:
                    assign_all = supabase.table("user_store_assignment").select("user_id, stores!inner(tenant_id)").in_("stores.tenant_id", target_tenant_ids).execute()
                    u_ids = [a["user_id"] for a in (assign_all.data or [])]
                    if u_ids:
                        m_all = supabase.table("users").select("user_id").in_("role_id", role_ids).in_("user_id", u_ids).execute()
                        valid_u_ids = set([m["user_id"] for m in (m_all.data or [])])
                        for a in (assign_all.data or []):
                            if a["user_id"] in valid_u_ids:
                                tid = a["stores"]["tenant_id"]
                                tenant_managers[tid] = tenant_managers.get(tid, 0) + 1
                                
                # Group requests by tenant
                tenant_reqs = {}
                for req in (reqs_res.data or []):
                    if req.get("approval_status") == "pending":
                        tid = req["stores"]["tenant_id"]
                        tenant_reqs[tid] = tenant_reqs.get(tid, 0) + 1
                        
                for t in tenants_list.data:
                    org_info = t.get("organizations")
                    org_name = org_info.get("name") if org_info else "Unknown"
                    tid = t["tenant_id"]
                    org_breakdown.append(OrgStat(
                        organization_name=org_name,
                        tenant_name=t.get("tenant_name", ""),
                        total_stores=tenant_stores.get(tid, 0),
                        total_managers=tenant_managers.get(tid, 0),
                        pending_requests=tenant_reqs.get(tid, 0)
                    ))

        return SuperadminStatsResponse(
            total_stores=total_stores, 
            total_managers=total_managers,
            pending_requests=pending_requests,
            approved_requests=approved_requests,
            declined_requests=declined_requests,
            organization_breakdown=org_breakdown
        )
    except Exception as e:
        print(f"Error fetching superadmin stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/managers", response_model=ManagersListResponse)
async def get_all_managers(
    organization_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    admin_info: dict = Depends(verify_superadmin)
):
    """
    Fetch all users with role 'store_manager' or 'supervisor'.
    """
    try:
        is_global = admin_info.get("is_global")
        my_tenant_id = admin_info.get("tenant_id")
        
        target_tenant_ids = []
        if not is_global:
            target_tenant_ids = [my_tenant_id]
        else:
            if tenant_id:
                target_tenant_ids = [tenant_id]
            elif organization_id:
                tenants_res = supabase.table("tenants").select("tenant_id").eq("organization_id", organization_id).execute()
                target_tenant_ids = [t["tenant_id"] for t in tenants_res.data]
            else:
                return ManagersListResponse(status="success", managers=[])
                
        if not target_tenant_ids:
            return ManagersListResponse(status="success", managers=[])
        
        # Get role IDs
        roles_res = supabase.table("roles").select("role_id, role_name").in_("role_name", ["store_manager", "supervisor"]).execute()
        role_map = {r["role_id"]: r["role_name"] for r in roles_res.data}
        role_ids = list(role_map.keys())
        
        if not role_ids:
            return ManagersListResponse(status="success", managers=[])
            
        # Fetch store assignments for these tenants
        assign_res = supabase.table("user_store_assignment").select("user_id, stores!inner(store_name, tenant_id)").in_("stores.tenant_id", target_tenant_ids).execute()
        user_ids = [a["user_id"] for a in assign_res.data]
        
        if not user_ids:
            return ManagersListResponse(status="success", managers=[])
            
        # Fetch users explicitly
        users_res = supabase.table("users").select("user_id, first_name, last_name, email, mobile_number, role_id, is_verified").in_("role_id", role_ids).in_("user_id", user_ids).order("created_at", desc=True).execute()
        
        assignments_map = {}
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
async def create_manager(request: ManagerCreateRequest, admin_info: dict = Depends(verify_superadmin)):
    """
    Create a new store manager or supervisor.
    """
    try:
        is_global = admin_info.get("is_global")
        my_tenant_id = admin_info.get("tenant_id")
        
        # Verify that the store they want to assign to belongs to their tenant
        store_res = supabase.table("stores").select("tenant_id, store_name, address, google_map_link").eq("store_id", request.store_id).execute()
        if not store_res.data:
            raise HTTPException(status_code=404, detail="Store not found")
        
        assigned_tenant_id = store_res.data[0].get("tenant_id")
        if not is_global and assigned_tenant_id != my_tenant_id:
            raise HTTPException(status_code=403, detail="Store does not belong to your tenant")
            
        tenant_id = assigned_tenant_id
            
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
            "role_id": role_id,
            "tenant_id": tenant_id
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

@router.get("/deletion-requests")
async def get_deletion_requests(admin_info: dict = Depends(verify_superadmin)):
    try:
        if not admin_info.get("is_global"):
            raise HTTPException(status_code=403, detail="Only global superadmins can access deletion requests.")
            
        # We need to join account_deletion_requests with users table to get first_name, last_name, mobile_number
        res = supabase.table("account_deletion_requests").select(
            "id, user_id, reason, requested_at, status, "
            "users (first_name, last_name, mobile_number)"
        ).eq("status", "pending").execute()
        
        requests = []
        for row in res.data:
            user_info = row.get("users") or {}
            if isinstance(user_info, list) and len(user_info) > 0:
                user_info = user_info[0]
            
            requests.append({
                "id": row.get("id"),
                "user_id": row.get("user_id"),
                "reason": row.get("reason"),
                "requested_at": row.get("requested_at"),
                "first_name": user_info.get("first_name", "Unknown"),
                "last_name": user_info.get("last_name", ""),
                "mobile_number": user_info.get("mobile_number", "Unknown")
            })
            
        return {"status": "success", "data": requests}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching deletion requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch deletion requests")

@router.post("/deletion-requests/{user_id}/permanent-delete")
async def permanent_delete_user(user_id: str, admin_info: dict = Depends(verify_superadmin)):
    try:
        if not admin_info.get("is_global"):
            raise HTTPException(status_code=403, detail="Only global superadmins can permanently delete users.")
            
        # Verify request exists and is older than 30 days
        req_res = supabase.table("account_deletion_requests").select("requested_at").eq("user_id", user_id).eq("status", "pending").execute()
        if not req_res.data:
            raise HTTPException(status_code=404, detail="Deletion request not found")
            
        requested_at = datetime.datetime.fromisoformat(req_res.data[0]["requested_at"].replace("Z", "+00:00"))
        if (datetime.datetime.now(datetime.timezone.utc) - requested_at).days < 30:
            raise HTTPException(status_code=400, detail="Cannot permanently delete before 30 days")
            
        # Hard delete from users table (cascades to requests)
        # Note: True permanent deletion from Auth requires admin API, but deleting from public.users is sufficient for application level
        del_res = supabase.table("users").delete().eq("user_id", user_id).execute()
        
        if not del_res.data:
             # Just in case users delete failed, update request status to deleted
             supabase.table("account_deletion_requests").update({"status": "deleted"}).eq("user_id", user_id).execute()

        return {"status": "success", "message": "User permanently deleted"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error permanently deleting user: {e}")
        raise HTTPException(status_code=500, detail="Failed to permanently delete user")
