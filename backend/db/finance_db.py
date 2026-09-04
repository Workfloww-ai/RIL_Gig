from utils.supabase_client import supabase
from datetime import datetime, timezone

def create_payment_record(job_assignment_id: str, worker_id: str, amount: float, upi_id: str = None):
    # Check if a payment record already exists for this assignment (idempotent)
    existing = supabase.table("payments").select("payment_id").eq("job_assignment_id", job_assignment_id).execute()
    if existing.data:
        return existing.data[0]
        
    now_iso = datetime.now(timezone.utc).isoformat()
    # If amount is Decimal it works, if float we round it
    from decimal import Decimal
    amount_paise = int(Decimal(str(amount)) * 100)
    
    payment_data = {
        "job_assignment_id": job_assignment_id,
        "worker_id": worker_id,
        "amount": amount_paise,
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
    response = supabase.rpc("get_payments_paginated", {
        "p_statuses": [status],
        "p_search": search,
        "p_date_from": date_from,
        "p_date_to": date_to,
        "p_page": page,
        "p_page_size": page_size
    }).execute()
    
    results = []
    total_count = 0
    if response.data:
        total_count = response.data[0].get("total_count", 0) if len(response.data) > 0 else 0
        for row in response.data:
            row["amount"] = float(row.get("amount", 0)) / 100.0
            results.append(row)
            
    return results, total_count

def process_payment(payment_id: str, processed_by: str, transaction_reference: str, remarks: str = None):
    now_iso = datetime.now(timezone.utc).isoformat()
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
    response = supabase.rpc("get_payments_paginated", {
        "p_statuses": ["completed", "failed"],
        "p_search": search,
        "p_date_from": date_from,
        "p_date_to": date_to,
        "p_page": page,
        "p_page_size": page_size
    }).execute()
    
    results = []
    total_count = 0
    if response.data:
        total_count = response.data[0].get("total_count", 0) if len(response.data) > 0 else 0
        for row in response.data:
            row["amount"] = float(row.get("amount", 0)) / 100.0
            results.append(row)
            
    return results, total_count

def get_dashboard_stats(finance_user_id: str):
    # Pending stats
    pending_resp = supabase.table("payments").select("amount").eq("payment_status", "pending").execute()
    pending_data = pending_resp.data or []
    total_pending_count = len(pending_data)
    total_pending_amount = sum(float(row.get("amount", 0)) / 100.0 for row in pending_data)
    
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
        amt = float(row.get("amount", 0)) / 100.0
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
