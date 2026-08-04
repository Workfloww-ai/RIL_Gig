from pydantic import BaseModel, EmailStr
from typing import Optional, List

class MobileCheckRequest(BaseModel):
    mobile_number: str

class SignupRequest(BaseModel):
    mobile_number: str
    first_name: str
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    dob: Optional[str] = None # YYYY-MM-DD
    gender: Optional[str] = None
    upi_id: Optional[str] = None
    alternate_number: Optional[str] = None

class DocumentMetadata(BaseModel):
    filename: str
    doc_name: str
    doc_number: Optional[str] = None

class SendOTPRequest(BaseModel):
    mobile_number: str

class VerifyOTPRequest(BaseModel):
    mobile_number: str
    otp: str
