from pydantic import BaseModel
from typing import List, Optional

class SuperadminJobResponse(BaseModel):
    request_id: str
    job_name: str
    store_name: str
    address: Optional[str] = None
    city: Optional[str] = None
    shift_date: str
    start_time: str
    workers_needed: int
    compensation: float
    approval_status: str
    decline_reason: Optional[str] = None

class RejectRequestPayload(BaseModel):
    decline_reason: str

class SuperadminRequestsResponse(BaseModel):
    status: str
    requests: List[SuperadminJobResponse]

class ActionResponse(BaseModel):
    status: str
    message: str

class StoreCreateRequest(BaseModel):
    store_name: str
    address: str
    city: str
    state: str
    pincode: str
    google_map_link: Optional[str] = None

class StoreResponse(BaseModel):
    store_id: str
    store_name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    google_map_link: Optional[str] = None
    manager_name: Optional[str] = None

class StoresListResponse(BaseModel):
    status: str
    stores: List[StoreResponse]

class ManagerCreateRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    mobile_number: str
    address: str
    city: str
    state: str
    pincode: str
    role: str # "store manager" or "supervisor"
    store_id: str

class ManagerResponse(BaseModel):
    user_id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    mobile_number: str
    role_name: str
    store_name: Optional[str] = None
    is_verified: bool = False

class ManagersListResponse(BaseModel):
    status: str
    managers: List[ManagerResponse]

class DeclineReason(BaseModel):
    id: str
    reason_text: str

class DeclineReasonsResponse(BaseModel):
    status: str
    reasons: List[DeclineReason]
