import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Path
from typing import List
import random

from .schemas import MobileCheckRequest, SignupRequest, DocumentMetadata, SendOTPRequest, VerifyOTPRequest
from utils.sms import send_otp_sms
from utils.supabase_client import supabase
from utils.jwt_auth import create_access_token, get_current_user, SECRET_KEY
from fastapi import Depends
import hmac
import hashlib

def hash_otp(otp: str) -> str:
    """Creates an HMAC-SHA256 hash of the OTP to prevent trivial brute force."""
    key = SECRET_KEY.encode('utf-8') if SECRET_KEY else b'default_secret_key_123'
    return hmac.new(key, str(otp).encode('utf-8'), hashlib.sha256).hexdigest()

router = APIRouter()

def get_mobile_variations(mobile: str):
    """Returns the mobile number without '+' and with '+' for robust DB querying."""
    clean = mobile.replace("+", "").replace(" ", "").strip()
    return clean, f"+{clean}"

@router.post("/check-mobile")
async def check_mobile(payload: MobileCheckRequest):
    clean, with_plus = get_mobile_variations(payload.mobile_number)
    # Check for both variations in the database to prevent duplicates
    response = supabase.table("users").select("*").or_(f"mobile_number.eq.{clean},mobile_number.eq.{with_plus}").execute()
    
    if len(response.data) > 0:
        # User exists, they should just login (we can trigger send OTP here or let them call /send-otp)
        return {"status": "existing_user", "message": "User found, proceed to login"}
    else:
        return {"status": "new_user", "message": "User not found, please proceed to signup"}

@router.get("/me")
async def get_my_profile(user_id: str = Depends(get_current_user)):
    from db.jobs_db import get_recent_activity
    response = supabase.table("users").select("first_name, last_name, email, mobile_number, role_id, ratings, shifts_completed").eq("user_id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = response.data[0]
    if user_data.get("role_id"):
        role_resp = supabase.table("roles").select("role_name").eq("role_id", user_data["role_id"]).execute()
        user_data["role_name"] = role_resp.data[0]["role_name"].lower() if role_resp.data else "worker"
    else:
        user_data["role_name"] = "worker"
        
    if user_data["role_name"] == "worker":
        user_data["recent_activity"] = get_recent_activity(user_id)
        
    return user_data

@router.get("/me/stats")
async def get_my_stats(user_id: str = Depends(get_current_user)):
    try:
        # Get store name
        assignment_response = supabase.table("user_store_assignment").select(
            "store_id, stores(store_name)"
        ).eq("user_id", user_id).execute()
        
        store_name = "Reliance Smart" # Default fallback
        if assignment_response.data and len(assignment_response.data) > 0:
            store_data = assignment_response.data[0].get("stores")
            if store_data:
                store_name = store_data.get("store_name", "Reliance Smart")

        # Get total requests raised by this manager's store (or by this manager specifically if we had created_by, but we only have store_assignment_id)
        # Actually, let's just count manpower_requests where store_id matches their assigned store_id
        total_requests = 0
        workers_hired = 0
        
        if assignment_response.data and len(assignment_response.data) > 0:
            store_id = assignment_response.data[0]["store_id"]
            requests_resp = supabase.table("manpower_requests").select("request_id", count="exact").eq("store_id", store_id).execute()
            total_requests = requests_resp.count if hasattr(requests_resp, 'count') and requests_resp.count is not None else len(requests_resp.data)
            
            # For workers hired, we can count worker_job_assignments for requests in this store
            hired_resp = supabase.table("worker_job_assignments").select("job_assignment_id", count="exact").eq("store_id", store_id).eq("assignment_status", "accepted").execute()
            workers_hired = hired_resp.count if hasattr(hired_resp, 'count') and hired_resp.count is not None else len(hired_resp.data)

        return {
            "store_name": store_name,
            "total_requests": total_requests,
            "workers_hired": workers_hired,
            "rating": 5.0
        }
    except Exception as e:
        print(f"Error fetching stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 1. POST /auth/signup
@router.post("/signup")
async def signup(payload: SignupRequest):
    # Fetch the default role_id for 'worker'
    role_response = supabase.table("roles").select("role_id").ilike("role_name", "worker").execute()
    if not role_response.data:
        raise HTTPException(status_code=500, detail="Default worker role not found in the database.")
    role_id = role_response.data[0]["role_id"]
    
    clean_mobile, _ = get_mobile_variations(payload.mobile_number)
    
    user_dict = {
        "mobile_number": clean_mobile,
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
    otp_code = "000000" 
    # otp_code = str(random.randint(100000, 999999))   # Default OTP for testing  ye line comment h 
    
    # Calculate expiration time (e.g., 5 minutes from now)
    from datetime import datetime, timedelta, timezone
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    
    # 1. Save OTP to DB
    clean_mobile, _ = get_mobile_variations(payload.mobile_number)
    try:
        supabase.table("otp_codes").insert({
            "mobile_number": clean_mobile, 
            "otp_hash": hash_otp(otp_code),
            "expires_at": expires_at
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save OTP to database: {str(e)}")
    
    # 2. Send SMS (Bypassed for testing)
    # ye line uncomment krni h baad me
    success = True   
    # success = await send_otp_sms(payload.mobile_number, otp_code)  
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send SMS. Check terminal logs for Dovesoft API errors.")
        
    return {"status": "otp_sent"}


# 4. POST /auth/verify-otp
@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTPRequest):
    # 1. Fetch OTP from DB
    clean, with_plus = get_mobile_variations(payload.mobile_number)
    response = supabase.table("otp_codes").select("*").or_(f"mobile_number.eq.{clean},mobile_number.eq.{with_plus}").order("created_at", desc=True).limit(1).execute()
    
    if not response.data:
        raise HTTPException(status_code=400, detail="No OTP found for this number.")
        
    otp_record = response.data[0]
    
    # 2. Check if OTP matches
    if str(otp_record["otp_hash"]) != hash_otp(payload.otp):
        raise HTTPException(status_code=400, detail="Incorrect OTP.")
        
    # 3. Check expiration
    from datetime import datetime, timezone
    expires_at_str = otp_record["expires_at"]
    if expires_at_str.endswith("Z"):
        expires_at_str = expires_at_str[:-1] + "+00:00"
    
    expires_at = datetime.fromisoformat(expires_at_str)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired.")
        
    # 5. Fetch user_id and role to inject into token and response
    clean_user, with_plus_user = get_mobile_variations(otp_record["mobile_number"])
    user_response = supabase.table("users").select("user_id, role_id").or_(f"mobile_number.eq.{clean_user},mobile_number.eq.{with_plus_user}").execute()
    if not user_response.data:
        raise HTTPException(status_code=400, detail="User account not found. Please sign up.")
    
    user_data = user_response.data[0]
    user_id = user_data["user_id"]
    
    role_name = "worker"
    if user_data.get("role_id"):
        role_resp = supabase.table("roles").select("role_name").eq("role_id", user_data["role_id"]).execute()
        if role_resp.data:
            role_name = role_resp.data[0]["role_name"].lower()
    
    access_token = create_access_token({"sub": user_id})
    return {"status": "login_success", "token": access_token, "role": role_name}


# 5. POST /auth/verify-and-signup
@router.post("/verify-and-signup")
async def verify_and_signup(
    mobile_number: str = Form(...),
    otp: str = Form(...),
    user_details: str = Form(..., description="JSON string of SignupRequest"),
    metadata: str = Form(..., description="JSON array of DocumentMetadata"),
    files: List[UploadFile] = File(...)
):
    # 1. Verify OTP from DB
    clean, with_plus = get_mobile_variations(mobile_number)
    otp_resp = supabase.table("otp_codes").select("*").or_(f"mobile_number.eq.{clean},mobile_number.eq.{with_plus}").order("created_at", desc=True).limit(1).execute()
    
    if not otp_resp.data:
        raise HTTPException(status_code=400, detail="No OTP found for this number.")
        
    otp_record = otp_resp.data[0]
    
    if str(otp_record["otp_hash"]) != hash_otp(otp):
        raise HTTPException(status_code=400, detail="Incorrect OTP.")
        
    from datetime import datetime, timezone
    expires_at_str = otp_record["expires_at"]
    if expires_at_str.endswith("Z"):
        expires_at_str = expires_at_str[:-1] + "+00:00"
    
    expires_at = datetime.fromisoformat(expires_at_str)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired.")
        
    # Delete OTP after verification
    supabase.table("otp_codes").delete().eq("id", otp_record["id"]).execute()
    
    # 2. Parse User Details
    try:
        user_data = json.loads(user_details)
        user_data["mobile_number"] = mobile_number # Add mobile number for validation
        
        # Convert empty strings to None for optional fields to pass Pydantic validation
        for key, value in user_data.items():
            if value == "":
                user_data[key] = None
                
        payload = SignupRequest(**user_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid user details JSON: {str(e)}")
        
    # 3. Create User
    role_response = supabase.table("roles").select("role_id").ilike("role_name", "worker").execute()
    if not role_response.data:
        raise HTTPException(status_code=500, detail="Default worker role not found.")
    role_id = role_response.data[0]["role_id"]
    
    user_dict = {
        "mobile_number": clean, # Use normalized mobile number
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
    user_dict = {k: v for k, v in user_dict.items() if v is not None and v != ""}
    
    try:
        user_res = supabase.table("users").insert(user_dict).execute()
        user_id = user_res.data[0]["user_id"]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create user: {str(e)}")
        
    # 4. Upload Documents
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
            
            try:
                existing = supabase.table("user_documents").select("*").eq("user_id", user_id).eq("doc_id", doc_id).execute()
                if len(existing.data) > 0:
                    res = supabase.table("user_documents").update({
                        "doc_number": meta.doc_number,
                        "doc_url": doc_url
                    }).eq("user_id", user_id).eq("doc_id", doc_id).execute()
                else:
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
                
    access_token = create_access_token({"sub": user_id})
    return {"status": "login_success", "token": access_token, "user_id": user_id, "uploaded_documents": len(uploaded_docs), "role": "worker"}
