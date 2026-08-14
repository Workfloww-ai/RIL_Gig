from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, time

class JobRoleResponse(BaseModel):
    job_id: str
    job_name: str
    base_compensation: float

class JobRequestCreate(BaseModel):
    job_id: str = Field(..., description="The UUID of the job")
    workers_needed: int = Field(..., gt=0, description="Number of workers needed")
    shift_date: date = Field(..., description="Date of the shift")
    start_time: time = Field(..., description="Start time of the shift")
    hours_duration: float = Field(..., gt=0, description="Duration in hours")
class JobRequestResponse(BaseModel):
    request_id: str
    job_id: str
    store_assignment_id: str
    store_id: str
    workers_needed: int
    shift_date: date
    start_time: time
    hours_duration: float
    approval_status: str
    request_status: str
    
    class Config:
        from_attributes = True









class JobResponse(BaseModel):
    request_id: str
    workers_needed: int
    shift_date: date
    start_time: time
    hours_duration: float
    request_status: str
    job_id: str
    job_name: str
    base_compensation: float
    store_id: str
    store_name: str
    address: Optional[str] = None
    city: Optional[str] = None

class AvailableJobsResponse(BaseModel):
    status: str
    jobs: List[JobResponse]

class AcceptJobResponse(BaseModel):
    status: str
    message: str

class AcceptedJobResponse(BaseModel):
    assignment_status: str
    request_id: str
    shift_date: date
    start_time: time
    hours_duration: float
    job_id: str
    job_name: str
    base_compensation: float
    store_id: str
    store_name: str
    address: Optional[str] = None
    city: Optional[str] = None

class MyAcceptedJobsResponse(BaseModel):
    status: str
    jobs: List[AcceptedJobResponse]
