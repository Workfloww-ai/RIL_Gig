from utils.supabase_client import supabase
from datetime import datetime

def create_payment_record(job_assignment_id: str, worker_id: str, amount: float, upi_id: str = None):
    # Check if a payment record already exists for this assignment (idempotent)
    existing = supabase.table("payments").select("payment_id").eq("job_assignment_id", job_assignment_id).execute()
    if existing.data:
        return existing.data[0]
        
    now_iso = datetime.now().isoformat()
    payment_data = {
        "job_assignment_id": job_assignment_id,
        "worker_id": worker_id,
        "amount": amount,
        "payment_status": "pending",
        "upi_id": upi_id,
        "payment_method": "upi",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    result = supabase.table("payments").insert(payment_data).execute()
    if result.data:
        return result.data[0]
    return None

def get_pending_payments(search: str = None, date_from: str = None, date_to: str = None, status: str = 'pending', page: int = 1, page_size: int = 20):
    # We need to manually join or use Supabase's foreign key relationships if defined.
    # Assuming the schema allows deep nested queries. 
    # Since we need fields from users, worker_job_assignments, manpower_requests, jobs, stores,
    # let's write a query that uses nested select.
    query = supabase.table("payments").select(
        "payment_id, amount, payment_status, upi_id, transaction_reference, processed_at, remarks, created_at, "
        "worker_id, "
        "users!fk_payments_worker(first_name, last_name, mobile_number, upi_id), "
        "worker_job_assignments!inner( "
            "request_id, "
            "manpower_requests!inner( "
                "shift_date, hours_duration, "
                "jobs(job_name, base_compensation), "
                "stores(store_name) "
            ") "
        ")",
        count="exact"
    ).eq("payment_status", status)
    
    if search:
        # Not easily done across tables with inner joins in Supabase python client without RPC, 
        # but we'll try basic filtering or filter in Python if needed.
        # It's better to fetch and filter, or just rely on what is possible.
        # But for now we just get without search in DB if complex, or try filtering.
        pass
        
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)
    
    # We will fetch and then filter/format in Python because of complex joins and search over relations.
    # Alternatively, let's fetch everything that is pending, filter by date_from, date_to in Python
    # if we cannot easily apply filters to manpower_requests.shift_date through payments table.
    
    # A cleaner approach in Supabase is using view or RPC, but we must use python client.
    # To be safe, let's just fetch payments with joined data and filter locally for search and dates.
    
    response = supabase.table("payments").select(
        "payment_id, amount, payment_status, upi_id, transaction_reference, processed_at, remarks, created_at, created_at, "
        "worker_id, "
        "users!fk_payments_worker(first_name, last_name, mobile_number, upi_id), "
        "worker_job_assignments( "
            "request_id, "
            "manpower_requests( "
                "shift_date, hours_duration, "
                "jobs(job_name, base_compensation), "
                "stores(store_name) "
            ") "
        ")"
    ).eq("payment_status", status).order("created_at", desc=True).execute()
    
    # Python-side filtering for search and dates due to Supabase deep filtering limitations
    results = []
    data = response.data or []
    for row in data:
        user = row.get("users") or {}
        wja = row.get("worker_job_assignments") or {}
        req = wja.get("manpower_requests") or {}
        job = req.get("jobs") or {}
        store = req.get("stores") or {}
        
        # Handle lists in joined data (Supabase sometimes returns lists for one-to-one if not strictly defined)
        if isinstance(user, list): user = user[0] if user else {}
        if isinstance(wja, list): wja = wja[0] if wja else {}
        if isinstance(req, list): req = req[0] if req else {}
        if isinstance(job, list): job = job[0] if job else {}
        if isinstance(store, list): store = store[0] if store else {}
        
        first_name = user.get("first_name") or ""
        last_name = user.get("last_name") or ""
        full_name = f"{first_name} {last_name}".strip()
        phone = user.get("mobile_number") or ""
        
        shift_date = req.get("shift_date") or ""
        
        # Date filtering
        if date_from and shift_date < date_from: continue
        if date_to and shift_date > date_to: continue
        
        # Search filtering
        if search:
            search_lower = search.lower()
            if search_lower not in full_name.lower() and search_lower not in phone:
                continue
                
        results.append({
            "payment_id": row.get("payment_id"),
            "worker_name": full_name,
            "worker_phone": phone,
            "worker_upi_id": row.get("upi_id") or user.get("upi_id"),
            "job_name": job.get("job_name", ""),
            "store_name": store.get("store_name", ""),
            "shift_date": shift_date,
            "hours_duration": req.get("hours_duration", 0),
            "amount": row.get("amount", 0),
            "payment_status": row.get("payment_status"),
            "transaction_reference": row.get("transaction_reference"),
            "processed_at": row.get("processed_at"),
            "remarks": row.get("remarks"), "created_at": row.get("created_at"),
            "created_at": row.get("created_at")
        })
        
    total_count = len(results)
    paginated_results = results[offset:offset+page_size]
    
    return paginated_results, total_count

def process_payment(payment_id: str, processed_by: str, transaction_reference: str, remarks: str = None):
    now_iso = datetime.now().isoformat()
    update_data = {
        "payment_status": "completed",
        "transaction_reference": transaction_reference,
        "processed_by": processed_by,
        "processed_at": now_iso,
        "updated_at": now_iso
    }
    if remarks is not None:
        update_data["remarks"] = remarks
        
    result = supabase.table("payments").update(update_data).eq("payment_id", payment_id).execute()
    if result.data:
        return result.data[0]
    return None

def get_payment_history(search: str = None, date_from: str = None, date_to: str = None, page: int = 1, page_size: int = 20):
    response = supabase.table("payments").select(
        "payment_id, amount, payment_status, upi_id, transaction_reference, processed_at, remarks, created_at, "
        "worker_id, "
        "users!fk_payments_worker(first_name, last_name, mobile_number, upi_id), "
        "worker_job_assignments( "
            "request_id, "
            "manpower_requests( "
                "shift_date, hours_duration, "
                "jobs(job_name, base_compensation), "
                "stores(store_name) "
            ") "
        ")"
    ).in_("payment_status", ["completed", "failed"]).order("processed_at", desc=True).execute()
    
    results = []
    data = response.data or []
    for row in data:
        user = row.get("users") or {}
        wja = row.get("worker_job_assignments") or {}
        req = wja.get("manpower_requests") or {}
        job = req.get("jobs") or {}
        store = req.get("stores") or {}
        
        if isinstance(user, list): user = user[0] if user else {}
        if isinstance(wja, list): wja = wja[0] if wja else {}
        if isinstance(req, list): req = req[0] if req else {}
        if isinstance(job, list): job = job[0] if job else {}
        if isinstance(store, list): store = store[0] if store else {}
        
        first_name = user.get("first_name") or ""
        last_name = user.get("last_name") or ""
        full_name = f"{first_name} {last_name}".strip()
        phone = user.get("mobile_number") or ""
        
        shift_date = req.get("shift_date") or ""
        
        if date_from and shift_date < date_from: continue
        if date_to and shift_date > date_to: continue
        
        if search:
            search_lower = search.lower()
            if search_lower not in full_name.lower() and search_lower not in phone:
                continue
                
        results.append({
            "payment_id": row.get("payment_id"),
            "worker_name": full_name,
            "worker_phone": phone,
            "worker_upi_id": row.get("upi_id") or user.get("upi_id"),
            "job_name": job.get("job_name", ""),
            "store_name": store.get("store_name", ""),
            "shift_date": shift_date,
            "hours_duration": req.get("hours_duration", 0),
            "amount": row.get("amount", 0),
            "payment_status": row.get("payment_status"),
            "transaction_reference": row.get("transaction_reference"),
            "processed_at": row.get("processed_at"),
            "remarks": row.get("remarks"), "created_at": row.get("created_at")
        })
        
    total_count = len(results)
    offset = (page - 1) * page_size
    paginated_results = results[offset:offset+page_size]
    
    return paginated_results, total_count

def get_dashboard_stats(finance_user_id: str):
    # Pending stats
    pending_resp = supabase.table("payments").select("amount").eq("payment_status", "pending").execute()
    pending_data = pending_resp.data or []
    total_pending_count = len(pending_data)
    total_pending_amount = sum(row.get("amount", 0) for row in pending_data)
    
    # Processed stats
    processed_resp = supabase.table("payments").select("amount, processed_at").eq("payment_status", "completed").execute()
    processed_data = processed_resp.data or []
    
    today_str = datetime.now().date().isoformat()
    this_month_str = datetime.now().strftime("%Y-%m")
    
    processed_today_count = 0
    processed_today_amount = 0
    processed_this_month_count = 0
    processed_this_month_amount = 0
    
    for row in processed_data:
        p_at = row.get("processed_at")
        amt = row.get("amount", 0)
        if p_at:
            if p_at.startswith(today_str):
                processed_today_count += 1
                processed_today_amount += amt
            if p_at.startswith(this_month_str):
                processed_this_month_count += 1
                processed_this_month_amount += amt
                
    return {
        "total_pending_count": total_pending_count,
        "total_pending_amount": total_pending_amount,
        "processed_today_count": processed_today_count,
        "processed_today_amount": processed_today_amount,
        "processed_this_month_count": processed_this_month_count,
        "processed_this_month_amount": processed_this_month_amount
    }
