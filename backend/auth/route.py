import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Path
from typing import List
import random

from .schemas import MobileCheckRequest, SignupRequest, DocumentMetadata, SendOTPRequest, VerifyOTPRequest
from utils.sms import send_otp_sms
from utils.supabase_client import supabase

router = APIRouter()

@router.post("/check-mobile")
async def check_mobile(payload: MobileCheckRequest):
    response = supabase.table("users").select("*").eq("mobile_number", payload.mobile_number).execute()
    
    if len(response.data) > 0:
        # User exists, they should just login (we can trigger send OTP here or let them call /send-otp)
        return {"status": "existing_user", "message": "User found, proceed to login"}
    else:
        return {"status": "new_user", "message": "User not found, please proceed to signup"}


# 1. POST /auth/signup
@router.post("/signup")
async def signup(payload: SignupRequest):
    # Fetch the default role_id for 'worker'
    role_response = supabase.table("roles").select("role_id").ilike("role_name", "worker").execute()
    if not role_response.data:
        raise HTTPException(status_code=500, detail="Default worker role not found in the database.")
    role_id = role_response.data[0]["role_id"]
    
    user_dict = {
        "mobile_number": payload.mobile_number,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "email": payload.email,
        "address": payload.address,
        "city": payload.city,
        "state": payload.state,
        "pincode": payload.pincode,
        "dob": payload.dob,
        "gender": payload.gender,
        "upi_id": payload.upi_id,
        "alternate_number": payload.alternate_number,
        "role_id": role_id
    }
    
    # Clean up None values
    user_dict = {k: v for k, v in user_dict.items() if v is not None}
    
    try:
        user_res = supabase.table("users").insert(user_dict).execute()
        user_id = user_res.data[0]["user_id"]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create user: {str(e)}")
        
    return {"status": "success", "user_id": user_id}


# 2. POST /users/{user_id}/documents
@router.post("/users/{user_id}/documents")
async def upload_documents(
    user_id: str = Path(...),
    metadata: str = Form(..., description="JSON array of DocumentMetadata"),
    files: List[UploadFile] = File(...)
):
    try:
        meta_list = json.loads(metadata)
        parsed_metadata = [DocumentMetadata(**m) for m in meta_list]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid metadata JSON: {str(e)}")

    uploaded_docs = []
    
    for file in files:
        meta = next((m for m in parsed_metadata if m.filename == file.filename), None)
        if meta:
            doc_type_resp = supabase.table("document_type").select("doc_id").ilike("name", meta.doc_name).execute()
            if not doc_type_resp.data:
                raise HTTPException(status_code=400, detail=f"Document type not found in database: {meta.doc_name}")
            
            doc_id = doc_type_resp.data[0]["doc_id"]
            
            file_bytes = await file.read()
            file_path = f"users/{user_id}/{file.filename}"
            
            try:
                supabase.storage.from_("documents").upload(
                    file_path, 
                    file_bytes, 
                    file_options={"upsert": "true"}
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Storage upload failed for {file.filename}: {str(e)}")
            
            doc_url = supabase.storage.from_("documents").get_public_url(file_path)
            
            # Manually check if document exists since there's no unique constraint for upsert
            try:
                existing = supabase.table("user_documents").select("*").eq("user_id", user_id).eq("doc_id", doc_id).execute()
                
                if len(existing.data) > 0:
                    # Update existing record
                    res = supabase.table("user_documents").update({
                        "doc_number": meta.doc_number,
                        "doc_url": doc_url
                    }).eq("user_id", user_id).eq("doc_id", doc_id).execute()
                else:
                    # Insert new record
                    res = supabase.table("user_documents").insert({
                        "user_id": user_id,
                        "doc_id": doc_id,
                        "doc_number": meta.doc_number,
                        "doc_url": doc_url
                    }).execute()
                
                if res.data:
                    uploaded_docs.append(res.data[0])
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Database operation failed for {meta.doc_name}: {str(e)}")
            
    return {"status": "success", "uploaded_documents": len(uploaded_docs)}


# 3. POST /auth/send-otp
@router.post("/send-otp")
async def send_otp(payload: SendOTPRequest):
    otp_code = str(random.randint(100000, 999999))
    
    # Calculate expiration time (e.g., 5 minutes from now)
    from datetime import datetime, timedelta, timezone
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    
    # 1. Save OTP to DB
    try:
        supabase.table("otp_codes").insert({
            "mobile_number": payload.mobile_number, 
            "otp_hash": otp_code,
            "expires_at": expires_at
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save OTP to database: {str(e)}")
    
    # 2. Send SMS
    success = await send_otp_sms(payload.mobile_number, otp_code)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send SMS. Check terminal logs for Dovesoft API errors.")
        
    return {"status": "otp_sent"}


# 4. POST /auth/verify-otp
@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTPRequest):
    is_valid = True # Mocking for now
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    access_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
    return {"status": "login_success", "token": access_token}
