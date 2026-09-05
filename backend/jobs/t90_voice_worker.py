import sys
import os

# Ensure backend root directory is in sys.path when executed directly as a script
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from dotenv import load_dotenv
load_dotenv()

import asyncio
import datetime
import logging
from db.jobs_db import get_pending_t90_call_assignments, update_t90_call_status
from utils.hunar_ai import trigger_t90_voice_call



logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("T90VoiceWorker")

async def process_t90_voice_calls():
    """
    Evaluates all active worker assignments and triggers Hunar.ai voice calls
    for workers whose shift starts in approximately 90 minutes (between 60 and 95 mins).
    """
    IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    now = datetime.datetime.now(IST)
    logger.info(f"[T90VoiceWorker] Checking DB at local system time: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        assignments = get_pending_t90_call_assignments()
        logger.info(f"[T90VoiceWorker] Found {len(assignments)} assignments in accepted & pending t90 status.")
        
        for assignment in assignments:
            assignment_id = assignment.get("job_assignment_id")
            req_info = assignment.get("manpower_requests") or {}
            store_info = assignment.get("stores") or {}
            worker_info = assignment.get("users") or {}
            
            # Handle potential nested lists if returned by Supabase join
            if isinstance(req_info, list) and len(req_info) > 0:
                req_info = req_info[0]
            if isinstance(store_info, list) and len(store_info) > 0:
                store_info = store_info[0]
            if isinstance(worker_info, list) and len(worker_info) > 0:
                worker_info = worker_info[0]
                
            shift_date_str = req_info.get("shift_date")
            start_time_str = req_info.get("start_time")
            
            if not shift_date_str or not start_time_str:
                logger.warning(f"[T90VoiceWorker] Assignment {assignment_id} missing shift_date or start_time")
                continue
                
            if len(start_time_str.split(':')) == 2:
                start_time_str += ":00"
                
            shift_dt_str = f"{shift_date_str} {start_time_str}"
            
            try:
                shift_dt = datetime.datetime.strptime(shift_dt_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
                time_diff = shift_dt - now
                minutes_until_shift = time_diff.total_seconds() / 60.0
                
                logger.info(
                    f"[T90VoiceWorker] Assignment {assignment_id}: Shift on {shift_dt_str}. "
                    f"Time until shift: {minutes_until_shift:.1f} mins (Target T-100 call window: 89 to 110 mins)."
                )

                # Check T-100 trigger window: between 89 and 110 minutes before shift start (so worker gets called before T-90 cut-off)
                if 89.0 <= minutes_until_shift <= 100.0:

                    mobile_number = worker_info.get("mobile_number")
                    worker_name = worker_info.get("first_name", "")
                    # last_name = worker_info.get("")
                    # worker_name = f"{worker_name}".strip() or "Sahyogi Worker"
                    store_name = store_info.get("store_name", "Reliance Store")
                    
                    job_data = req_info.get("jobs") or {}
                    if isinstance(job_data, list) and len(job_data) > 0:
                        job_data = job_data[0]
                    job_title = job_data.get("job_name", "Gig Worker")
                    payout_rate = str(job_data.get("base_compensation", "₹500"))
                    
                    if not mobile_number:
                        logger.warning(f"[T90VoiceWorker] No mobile number found for assignment {assignment_id}")
                        continue
                        
                    masked_number = f"+91 ****{mobile_number[-4:]}" if mobile_number and len(mobile_number) >= 4 else "****"
                    masked_name = " ".join([p[0] + "***" for p in worker_name.split()])
                    logger.info(
                        f"[T90VoiceWorker] Triggering T-90 call for assignment {assignment_id} "
                        f"to {masked_name} ({masked_number}). Shift in {minutes_until_shift:.1f} mins."
                    )
                    
                    # Mark status as call_initiated first to avoid race conditions
                    update_t90_call_status(assignment_id, new_status="call_initiated")
                    
                    # Trigger Hunar AI call
                    result = await trigger_t90_voice_call(
                        worker_phone=mobile_number,
                        worker_name=worker_name,
                        store_name=store_name,
                        shift_time=start_time_str,
                        job_title=job_title,
                        payout_rate=payout_rate
                    )

                    
                    # logger.info(f"[T90VoiceWorker] Call dispatch result for {assignment_id}: {result}")
                    
            except Exception as ex:
                logger.error(f"[T90VoiceWorker] Error processing assignment {assignment_id}: {ex}")
                
    except Exception as e:
        logger.error(f"[T90VoiceWorker] Error fetching T-90 assignments: {e}")

def run_t90_worker_sync():
    """Synchronous wrapper for integration with background schedulers or CLI execution."""
    asyncio.run(process_t90_voice_calls())

if __name__ == "__main__":
    import time
    from dotenv import load_dotenv
    POLL_INTERVAL = 30 # seconds
    logger.info(f"Starting T-90 Voice Worker Daemon (Polling DB every {POLL_INTERVAL} seconds). Press Ctrl+C to stop.\n")
    try:
        while True:
            # Reload .env on each tick so the flag can be toggled without restarting the script
            load_dotenv(override=True)
            is_worker_on = os.getenv("IS_WORKER_ON", "false").lower() in ("true", "1", "t", "yes")
            
            if is_worker_on:
                run_t90_worker_sync()
            else:
                logger.info("[T90VoiceWorker] IS_WORKER_ON is not set to true. Skipping this cycle.")
                
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        logger.info("\n[T90VoiceWorker] Daemon stopped by user.")

