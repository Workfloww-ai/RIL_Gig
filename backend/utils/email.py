import smtplib
from email.message import EmailMessage

# For testing, we'll just print to console if no SMTP is configured,
# but we provide the structure so it can be easily hooked up later.

def send_welcome_email(to_email: str, manager_name: str, role: str, store_name: str, store_address: str):
    """
    Sends a welcome email to the newly created manager/supervisor.
    """
    subject = f"Welcome to RIL Gig! You've been assigned as a {role.title()}"
    
    body = f"""Hello {manager_name},

You have been successfully added as a {role.title()} in our system.

Your Assigned Store Details:
- Store Name: {store_name}
- Store Address: {store_address}

Welcome to the team!

Best regards,
Superadmin Team
"""
    
    print(f"\n{'='*50}\n[EMAIL MOCK] To: {to_email}\nSubject: {subject}\n\n{body}\n{'='*50}\n")
    
    # In a real implementation, you would do:
    # msg = EmailMessage()
    # msg.set_content(body)
    # msg['Subject'] = subject
    # msg['From'] = "no-reply@rilgig.com"
    # msg['To'] = to_email
    # 
    # try:
    #     server = smtplib.SMTP('smtp.example.com', 587)
    #     server.starttls()
    #     server.login("username", "password")
    #     server.send_message(msg)
    #     server.quit()
    # except Exception as e:
    #     print(f"Failed to send email: {e}")
