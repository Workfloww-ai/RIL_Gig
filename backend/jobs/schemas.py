from pydantic import BaseModel, Field
from datetime import date, time

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
    job_id: str
    title: str
    base_compensation: float
    
    class Config:
        from_attributes = True
