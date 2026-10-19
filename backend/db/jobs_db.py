from utils.supabase_client import supabase
from fastapi import HTTPException, status
from typing import Dict, Any

def create_job_request(user_id: str, request_data: Dict[str, Any]):
    """
    Creates a new job request (manpower request) for a store manager.
    Validates that the user is an active store manager and extracts store_id.
    """
    try:
        # 1. Verify the user is an active store manager and get their store assignment
        assignment_response = supabase.table("user_store_assignment").select(
            "assignment_id, store_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not assignment_response.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have an active store manager assignment."
            )
            
        store_assignment_id = assignment_response.data[0]["assignment_id"]
        store_id = assignment_response.data[0]["store_id"]
        
        # 2. Category selection is strictly required
        category_id = request_data.get("category_id")
        if not category_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A job category must be explicitly selected before raising a request."
            )

        # Verify that category exists, is active, and belongs to an active domain
        try:
            cat_resp = supabase.table("job_categories").select("category_id, domain_id, name, is_active").eq("category_id", category_id).limit(1).execute()
        except Exception:
            cat_resp = supabase.table("job_categories").select("category_id, domain_id, name").eq("category_id", category_id).limit(1).execute()

        if not cat_resp.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected job category is invalid."
            )
        category_info = cat_resp.data[0]

        if category_info.get("is_active") is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category '{category_info.get('name')}' is currently inactive and cannot be selected."
            )

        # Verify that the category's domain is active
        if category_info.get("domain_id"):
            try:
                dom_resp = supabase.table("job_domains").select("domain_id, name, is_active").eq("domain_id", category_info["domain_id"]).limit(1).execute()
                if dom_resp.data and dom_resp.data[0].get("is_active") is False:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Domain '{dom_resp.data[0].get('name')}' is currently inactive. Categories of this domain cannot be chosen."
                    )
            except HTTPException:
                raise
            except Exception:
                pass

        # Verify that the store's domain matches the category's domain
        store_resp = supabase.table("stores").select("domain_id").eq("store_id", store_id).limit(1).execute()
        if store_resp.data and store_resp.data[0].get("domain_id"):
            store_domain_id = store_resp.data[0]["domain_id"]
            if category_info.get("domain_id") and store_domain_id != category_info["domain_id"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Store cannot raise this job: The selected category does not belong to the store's assigned domain."
                )

        # Ensure the job role is tagged with this category if column exists
        job_id = request_data["job_id"]
        try:
            supabase.table("jobs").update({"category_id": category_id}).eq("job_id", job_id).execute()
        except Exception:
            try:
                supabase.table("jobs").update({"category": category_id}).eq("job_id", job_id).execute()
            except Exception:
                pass

        # 2. Prepare the payload for manpower_requests
        payload = {
            "job_id": request_data["job_id"],
            "store_assignment_id": store_assignment_id,
            "store_id": store_id,
            "workers_needed": request_data["workers_needed"],
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
                detail="Failed to create job request: No data returned."
            )
            
        return insert_response.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in create_job_request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

def get_all_jobs(limit: int = None, offset: int = None, category_id: str = None):
    """
    Fetches available jobs to populate the dropdown on the frontend.
    Filters by category ID (supporting both 'category_id' and 'category' column names).
    Explicitly mentions column names per enterprise guidelines.
    """
    data = []

    # 1. Try querying with column 'category_id'
    try:
        query = supabase.table("jobs").select("job_id, job_name, base_compensation, category_id")
        if category_id:
            query = query.eq("category_id", category_id)
        if limit is not None and offset is not None:
            query = query.range(offset, offset + limit - 1)
        resp = query.execute()
        if resp.data:
            data = resp.data
    except Exception as e:
        print(f"[get_all_jobs] Query with category_id failed: {e}")
        data = []

    # 2. If no jobs found with category_id, try querying by column 'category'
    if not data and category_id:
        try:
            query = supabase.table("jobs").select("job_id, job_name, base_compensation, category")
            query = query.eq("category", category_id)
            if limit is not None and offset is not None:
                query = query.range(offset, offset + limit - 1)
            resp = query.execute()
            if resp.data:
                for item in resp.data:
                    item["category_id"] = item.get("category")
                data = resp.data
        except Exception as e:
            print(f"[get_all_jobs] Query with category failed: {e}")

    # 3. Fallback: If no category_id was provided (all jobs), query base jobs
    if not data and not category_id:
        try:
            query = supabase.table("jobs").select("job_id, job_name, base_compensation")
            if limit is not None and offset is not None:
                query = query.range(offset, offset + limit - 1)
            resp = query.execute()
            data = resp.data or []
        except Exception as e:
            print(f"[get_all_jobs] Base query failed: {e}")
            data = []

    # Clean and format output
    formatted = []
    for item in (data or []):
        comp = item.get("base_compensation")
        try:
            comp_val = float(comp) if comp is not None else 0.0
        except (ValueError, TypeError):
            comp_val = 0.0

        formatted.append({
            "job_id": item.get("job_id"),
            "job_name": item.get("job_name"),
            "base_compensation": comp_val,
            "category_id": item.get("category_id") or item.get("category") or category_id
        })

    return formatted

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
        "users!fk_wja_worker(first_name, mobile_number)"
    ).eq("assignment_status", "accepted").eq("t90_status", "pending").execute()
    
    return response.data if response.data else []


def claim_t90_assignment(job_assignment_id: str) -> bool:
    """
    Atomically claims a pending T90 assignment by updating t90_status from 'pending' to 'call_initiated'.
    Returns True if this replica successfully claimed it (row was still 'pending'),
    or False if another replica already claimed it.
    This replaces the previous Redis distributed lock with a DB-level atomic guard.
    """
    response = supabase.table("worker_job_assignments").update({
        "t90_status": "call_initiated"
    }).eq("job_assignment_id", job_assignment_id).eq("t90_status", "pending").execute()
    return bool(response.data)


def update_t90_call_status(job_assignment_id: str, new_status: str = "call_initiated"):
    """
    Updates the t90_status or call status of a worker job assignment after a Hunar voice call dispatch.
    """
    response = supabase.table("worker_job_assignments").update({
        "t90_status": new_status
    }).eq("job_assignment_id", job_assignment_id).execute()
    return response.data

def get_recent_activity(user_id: str):
    """
    Fetches the recent completed jobs (activity) for a worker.
    """
    response = supabase.table("worker_job_assignments").select(
        "job_assignment_id, assignment_status, updated_at, extension_status, extension_hours, stores(store_name), manpower_requests(request_id, shift_date, hours_duration, jobs(job_name, base_compensation)), payments(payment_status)"
    ).eq("worker_id", user_id).eq("assignment_status", "completed").order("updated_at", desc=True).execute()
    
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
            
        store = row.get("stores")
        if isinstance(store, list) and len(store) > 0:
            store_name = store[0].get("store_name", "Unknown Store")
        elif isinstance(store, dict):
            store_name = store.get("store_name", "Unknown Store")
        else:
            store_name = "Unknown Store"
            
        hours = float(req.get("hours_duration", 0))
        rate = float(job.get("base_compensation", 0))
        
        # Calculate amount including extension premium
        base_amount = hours * rate
        ext_status = row.get("extension_status")
        ext_hours = float(row.get("extension_hours") or 0)
        ext_amount = (ext_hours * rate * 1.1) if ext_status == "accepted" else 0
        amount = round(base_amount + ext_amount)
        
        payment = row.get("payments")
        payment_status = "pending"
        if isinstance(payment, list) and len(payment) > 0:
            payment_status = payment[0].get("payment_status", "pending")
        elif isinstance(payment, dict):
            payment_status = payment.get("payment_status", "pending")

        activities.append({
            "id": row.get("job_assignment_id"),
            "job_name": job.get("job_name", "Unknown Job"),
            "store_name": store_name,
            "shift_date": req.get("shift_date"),
            "hours": hours,
            "amount": amount,
            "updated_at": row.get("updated_at"),
            "payment_status": payment_status
        })
    return activities
