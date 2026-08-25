import httpx
import logging
import os
import uuid
from typing import Dict, Any, Optional

DEFAULT_HUNAR_URL = "https://api.voice.hunar.ai/external/v1/calls/"
HUNAR_API_URL = os.environ.get("HUNAR_API_URL", DEFAULT_HUNAR_URL)
HUNAR_API_KEY = os.environ.get("HUNAR_API_KEY", "")
HUNAR_AGENT_ID = os.environ.get("HUNAR_AGENT_ID", "")

# Ensure URL targets /calls/ endpoint as required by Hunar Voice API
if "/agents" in HUNAR_API_URL:
    HUNAR_API_URL = HUNAR_API_URL.replace("/agents/", "/calls/").replace("/agents", "/calls/")

if not HUNAR_API_URL.endswith("/"):
    HUNAR_API_URL += "/"

async def trigger_voice_agent_call(
    agent_id: str,
    callee_name: str,
    mobile_number: str,
    custom_data: Dict[str, Any],
    request_prefix: str = "hunar-call"
) -> Dict[str, Any]:
    """
    Generalized Hunar.ai Voice Agent Gateway Client.
    Use this function to trigger ANY outbound voice call agent on Hunar.ai.

    :param agent_id: The Hunar.ai Agent UUID
    :param callee_name: Name of the recipient
    :param mobile_number: Recipient's mobile number
    :param custom_data: Dictionary of prompt variables required by the agent
    :param request_prefix: Unique string prefix for tracking request_id
    """
    clean_phone = mobile_number.strip()
    if not clean_phone.startswith("+") and not clean_phone.startswith("91"):
        clean_phone = f"+91{clean_phone}"
    elif not clean_phone.startswith("+"):
        clean_phone = f"+{clean_phone}"

    request_id = f"{request_prefix}-{uuid.uuid4().hex[:8]}"

    payload = {
        "agent_id": agent_id,
        "callee_name": callee_name,
        "mobile_number": clean_phone,
        "custom_data": custom_data,
        "request_id": request_id
    }

    headers = {
        "X-API-Key": HUNAR_API_KEY,
        "Content-Type": "application/json"
    }

    logging.info(f"[HunarAI] Dispatching voice call (Agent: {agent_id}) to {callee_name} ({clean_phone})...")

    if not HUNAR_API_KEY or HUNAR_API_KEY.startswith("dummy"):
        logging.warning("[HunarAI] HUNAR_API_KEY not configured or dummy; simulating call success response.")
        return {
            "status": "success",
            "simulated": True,
            "call_id": f"sim_call_{os.urandom(4).hex()}",
            "message": f"Simulated call dispatched to {clean_phone}"
        }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                HUNAR_API_URL,
                json=payload,
                headers=headers,
                timeout=10.0
            )
            logging.info(f"[HunarAI] HTTP {response.status_code} Response: {response.text}")
            response.raise_for_status()
            resp_data = response.json()
            return {
                "status": "success",
                "simulated": False,
                "data": resp_data
            }
    except httpx.HTTPStatusError as http_err:
        logging.error(f"[HunarAI] HTTP {http_err.response.status_code} Error: {http_err.response.text}")
        return {
            "status": "error",
            "simulated": False,
            "error": f"HTTP {http_err.response.status_code}: {http_err.response.text}"
        }
    except Exception as e:
        logging.error(f"[HunarAI] Failed to dispatch voice call to {clean_phone}: {str(e)}")
        return {
            "status": "error",
            "simulated": False,
            "error": str(e)
        }

async def trigger_t90_voice_call(
    worker_phone: str,
    worker_name: str,
    store_name: str,
    shift_time: str,
    job_title: str = "Store Associate",
    payout_rate: str = "standard rate",
    agent_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience wrapper for T-90 shift confirmation voice calls.
    """
    target_agent_id = agent_id or HUNAR_AGENT_ID

    custom_data = {
        "gig_title": job_title,
        "payout_rate": str(payout_rate),
        "start_time": shift_time,
        "location_name": store_name,
        "worker_name": worker_name,
        "prompt_instructions": (
            f"Hello {worker_name}, your T-90 confirmation window for your shift at {store_name} "
            f"starting at {shift_time} is now open. Please open the Sahyogi app right now and click the T-90 confirmation button."
        )
    }

    return await trigger_voice_agent_call(
        agent_id=target_agent_id,
        callee_name=worker_name,
        mobile_number=worker_phone,
        custom_data=custom_data,
        request_prefix="t90-call"
    )
