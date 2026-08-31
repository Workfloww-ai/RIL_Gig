from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from .schemas import (
    ProcessPaymentRequest, 
    PendingPaymentsResponse, 
    PaymentHistoryResponse, 
    DashboardStatsResponse
)
from db.finance_db import (
    get_pending_payments,
    process_payment,
    get_payment_history,
    get_dashboard_stats
)
from utils.jwt_auth import get_current_user
from utils.supabase_client import supabase

router = APIRouter()

def verify_finance_role(user_id: str):
    user_resp = supabase.table("users").select("role_id").eq("user_id", user_id).execute()
    if not user_resp.data or not user_resp.data[0].get("role_id"):
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    role_resp = supabase.table("roles").select("role_name").eq("role_id", user_resp.data[0]["role_id"]).execute()
    if not role_resp.data or role_resp.data[0].get("role_name") != "finance":
        raise HTTPException(status_code=403, detail="Finance access required")

@router.get("/pending-payments", response_model=PendingPaymentsResponse)
async def get_pending(
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: str = 'pending',
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user)
):
    verify_finance_role(user_id)
    try:
        payments, total_count = get_pending_payments(search, date_from, date_to, status, page, page_size)
        return PendingPaymentsResponse(
            status="success",
            payments=payments,
            total_count=total_count,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        print(f"Error fetching pending payments: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process-payment/{payment_id}")
async def process_payment_endpoint(
    payment_id: str,
    payload: ProcessPaymentRequest,
    user_id: str = Depends(get_current_user)
):
    verify_finance_role(user_id)
    try:
        updated_payment = process_payment(
            payment_id=payment_id,
            processed_by=user_id,
            transaction_reference=payload.transaction_reference,
            remarks=payload.remarks
        )
        if not updated_payment:
            raise HTTPException(status_code=404, detail="Payment record not found")
            
        return {"status": "success", "message": "Payment processed successfully", "payment": updated_payment}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing payment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/payment-history", response_model=PaymentHistoryResponse)
async def payment_history(
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user)
):
    verify_finance_role(user_id)
    try:
        payments, total_count = get_payment_history(search, date_from, date_to, page, page_size)
        return PaymentHistoryResponse(
            status="success",
            payments=payments,
            total_count=total_count,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        print(f"Error fetching payment history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard-stats", response_model=DashboardStatsResponse)
async def dashboard_stats(user_id: str = Depends(get_current_user)):
    verify_finance_role(user_id)
    try:
        stats = get_dashboard_stats(user_id)
        return DashboardStatsResponse(**stats)
    except Exception as e:
        print(f"Error fetching dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
