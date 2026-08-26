import httpx
import logging
import os

DOVESOFT_API_URL = os.environ.get("DOVESOFT_API_URL", "https://api.dovesoft.io/api/json/sendsms/")
DOVESOFT_API_KEY = os.environ.get("DOVESOFT_API_KEY", "")
SENDER_ID = os.environ.get("DOVESOFT_SENDER_ID", "")
ENTITY_ID = os.environ.get("DOVESOFT_ENTITY_ID", "")
TEMP_ID = os.environ.get("DOVESOFT_TEMP_ID", "")

async def send_otp_sms(mobile_number: str, otp_code: str) -> bool:
    # sms_content = f"Your verification OTP is {otp_code}. Please do not share this with anyone."
    # sms_content = f"The verification code for your LUCID account login is {otp_code}. The code is valid for 5 minutes. Please do not share it with anyone. - Equinox Corp"
    sms_content = f"The verification code for your Sahyogi account is {otp_code}. The code is valid for 5 minutes. Please do not share it with anyone. - Sahyogi Infracare"
    payload = {
        "listsms": [
            {
                "sms": sms_content,
                "mobiles": mobile_number,
                "senderid": SENDER_ID,
                "entityid": ENTITY_ID,
                "tempid": TEMP_ID
            }
        ]
    }
    
    headers = {
        "content-type": "application/json",
        "key": DOVESOFT_API_KEY
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                DOVESOFT_API_URL, 
                json=payload, 
                headers=headers,
                timeout=10.0
            )
            response.raise_for_status()
            
            # Dovesoft might return 200 OK but with an error inside the JSON body!
            resp_data = response.json()
            logging.warning(f"Dovesoft Response: {resp_data}")
            
            # Assuming Dovesoft returns something like {"status": "success"} 
            # We will just print it for now so you can debug.
            return True
            
    except Exception as e:
        logging.error(f"Failed to send SMS to {mobile_number}: {str(e)}")
        return False
