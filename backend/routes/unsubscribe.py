from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, EmailStr
from workers.arq_worker import verify_unsubscribe_token
from db.notifications_db import update_unsubscribe_status, find_user_by_email

router = APIRouter(tags=["CAN-SPAM Unsubscribe"])

class ManualUnsubscribeRequest(BaseModel):
    email: EmailStr

@router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe_get(token: str = Query(...)):
    """
    RFC 8058 Compliant One-Click Unsubscribe Handler.
    Verifies HMAC signature, atomically syncs unsubscribed flags,
    and returns a branded confirmation screen.
    """
    user_id = verify_unsubscribe_token(token)
    if not user_id:
        return HTMLResponse(
            content="""
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h2 style="color: #dc2626;">Invalid or Expired Link</h2>
                    <p>The unsubscribe link is invalid or has expired.</p>
                </body>
            </html>
            """,
            status_code=400
        )

    # Atomically update both users.email_unsubscribed and notification_preferences.email_enabled
    update_unsubscribe_status(user_id)

    return HTMLResponse(
        content="""
        <!DOCTYPE html>
        <html>
            <head>
                <title>Unsubscribe Confirmed | SahYogi</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px; display: flex; justify-content: center; align-items: center; min-height: 80vh;">
                <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 480px; width: 100%; padding: 36px; text-align: center;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background-color: #dcfce7; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <h2 style="color: #111827; margin: 0 0 12px 0; font-size: 24px; font-weight: 700;">Successfully Unsubscribed</h2>
                    <p style="color: #4b5563; font-size: 15px; line-height: 22px; margin: 0 0 24px 0;">
                        You have been removed from our automated email notifications in accordance with CAN-SPAM regulations.
                    </p>
                    <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                        You will still receive critical in-app notifications regarding shifts and account security.
                    </p>
                </div>
            </body>
        </html>
        """
    )

@router.post("/unsubscribe", response_class=JSONResponse)
async def unsubscribe_post(token: str = Query(...)):
    """
    RFC 8058 POST Handler for email clients (List-Unsubscribe=One-Click).
    """
    user_id = verify_unsubscribe_token(token)
    if not user_id:
        return JSONResponse(status_code=400, content={"success": False, "message": "Invalid token"})

    update_unsubscribe_status(user_id)
    return JSONResponse(status_code=200, content={"success": True, "message": "Unsubscribed"})

@router.post("/unsubscribe/manual", response_class=JSONResponse)
async def manual_unsubscribe(req: ManualUnsubscribeRequest):
    """
    Manual unsubscribe portal protected against Account Enumeration.
    Always returns a uniform generic success message whether the email exists in DB or not.
    """
    user = find_user_by_email(req.email)
    if user:
        update_unsubscribe_status(user["user_id"])

    # Anti-Enumeration: ALWAYS return identical generic confirmation
    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "message": "If this email exists in our system, you have been unsubscribed from all email communications."
        }
    )
