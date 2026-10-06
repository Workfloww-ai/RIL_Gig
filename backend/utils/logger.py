import traceback
from fastapi import Request
from utils.supabase_client import supabase

async def log_error_to_supabase(request: Request, status_code: int, error_message: str):
    """
    Asynchronously logs an HTTP error to the Supabase error_logs table.
    """
    try:
        # We can extract the user ID if they were authenticated
        # In FastAPI, we usually put the current_user in request.state if authenticated
        user_id = None
        if hasattr(request.state, "user") and request.state.user:
            user_id = request.state.user.get("id")

        client_ip = request.client.host if request.client else None

        # Insert into Supabase
        supabase.table("error_logs").insert({
            "method": request.method,
            "endpoint": str(request.url.path),
            "status_code": status_code,
            "error_message": str(error_message),
            "client_ip": client_ip,
            "user_id": user_id
        }).execute()
        
    except Exception as e:
        # Fallback to standard console logging if Supabase insert fails
        print(f"[ErrorLogger] Failed to save error to Supabase: {str(e)}")
