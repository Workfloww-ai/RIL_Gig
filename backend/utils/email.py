import os
import requests

def send_welcome_email(to_email: str, manager_name: str, role: str, store_name: str, store_address: str, google_map_link: str):
    """
    Sends a welcome email to the newly created manager/supervisor using Resend API.
    """
    subject = f"Welcome to SahYogi! You've been assigned as a {role.title()}"
    
    body = f"""<p>Hello {manager_name},</p>
<p>You have been successfully added as a <strong>{role.replace('_', ' ').title()}</strong> in our system.</p>
<br>
<p><strong>Your Assigned Store Details:</strong></p>
<ul>
    <li><strong>Store Name:</strong> {store_name}</li>
    <li><strong>Store Address:</strong> {store_address}</li>
    <li><strong>Google Map Link:</strong> <a href="{google_map_link}">{google_map_link}</a></li>
</ul>
<br>
<p><strong>Action Required - Please Verify Your Account:</strong></p>
<p>Please download the SahYogi app from the link below and log in to confirm your verification.</p>
<p><strong>Download App:</strong> <a href=https://expo.dev/artifacts/eas/wpOrPP-kUZnySaysCKrzSjkiq5jSiBeSNpx_cmB7nmc.apk
>Download SahYogi</a></p>
<br>
<p><strong>How to Login:</strong></p>
<ol>
    <li>Open the app and select <strong>Login</strong>.</li>
    <li>Enter your registered mobile number.</li>
    <li>You will receive an OTP via SMS. Enter it to verify and access your dashboard.</li>
</ol>
<br>
<p>Welcome to the team!</p>
<br>
<p>Best regards,<br>SahYogi Team</p>
"""
    
    resend_api_key = os.getenv("RESEND_API_KEY")
    sender_email = os.getenv("SENDER_EMAIL")
    
    if not resend_api_key:
        print(f"RESEND_API_KEY is not set. Email not sent to {to_email}.")
        return
        
    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": sender_email,
                "to": [to_email],
                "subject": subject,
                "html": body
            }
        )
        
        if response.status_code >= 400:
            print(f"Failed to send email via Resend: {response.status_code} - {response.text}")
        else:
            print(f"Successfully sent welcome email to {to_email}")
            
    except Exception as e:
        print(f"Exception occurred while sending email: {e}")
