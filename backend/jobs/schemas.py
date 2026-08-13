from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time

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
