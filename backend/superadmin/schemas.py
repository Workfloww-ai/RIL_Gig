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

