from pydantic import BaseModel
from typing import List, Optional

class ProcessPaymentRequest(BaseModel):
    transaction_reference: str
    remarks: Optional[str] = None

class PaymentRecord(BaseModel):
    payment_id: str
    worker_name: str
    worker_phone: str
    worker_upi_id: Optional[str] = None
    job_name: str
    store_name: str
    shift_date: str
    hours_duration: float
    amount: float
    payment_status: str
    transaction_reference: Optional[str] = None
    processed_at: Optional[str] = None
    remarks: Optional[str] = None
    created_at: Optional[str] = None

class PendingPaymentsResponse(BaseModel):
    status: str
    payments: List[PaymentRecord]
    total_count: int
    page: int
    page_size: int

class PaymentHistoryResponse(BaseModel):
    status: str
    payments: List[PaymentRecord]
    total_count: int
    page: int
    page_size: int

class DashboardStatsResponse(BaseModel):
    total_pending_count: int
    total_pending_amount: float
    processed_today_count: int
    processed_today_amount: float
    processed_this_month_count: int
    processed_this_month_amount: float
