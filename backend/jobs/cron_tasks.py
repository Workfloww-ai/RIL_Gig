import sys
import os

backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

import datetime
from utils.supabase_client import supabase


# def check_t60_status():
#     """
#     Cron job to evaluate T-90 logic.
#     Runs periodically to check if workers missed T-90.
#     """
#     try:
#         now = datetime.datetime.now()
#         print(f"[{now.strftime('%H:%M:%S')}] [Cron] Starting Checkpoint Cron Job...")
        
#         # We look for shifts that are starting in less than 60 minutes
#         assignments = supabase.table("worker_job_assignments").select(
#             "job_assignment_id, request_id, t90_status, t60_status, manpower_requests(shift_date, start_time, request_status)"
#         ).eq("assignment_status", "accepted").execute()
        
#         print(f"[Cron] Found {len(assignments.data)} active accepted worker assignments.")
        
#         for a in assignments.data:
#             req_info = a.get("manpower_requests")
#             if not req_info:
#                 continue
                
#             shift_date_str = req_info.get("shift_date")
#             start_time_str = req_info.get("start_time")
            
#             if shift_date_str and start_time_str:
#                 if len(start_time_str.split(':')) == 2:
#                     start_time_str += ":00"
#                 shift_dt_str = f"{shift_date_str} {start_time_str}"
#                 try:
#                     shift_dt = datetime.datetime.strptime(shift_dt_str, "%Y-%m-%d %H:%M:%S")
#                     time_diff = shift_dt - now
#                     minutes_until_shift = time_diff.total_seconds() / 60.0
                    
#                     if minutes_until_shift > 0:
#                         t90 = a.get("t90_status")
#                         t60 = a.get("t60_status")
                        
#                         cancel_reason = None
                        
#                         # Missed T-90 Checkpoint
#                         if minutes_until_shift <= 90 and t90 in ["missed", "pending"]:
#                             cancel_reason = "Auto-cancelled due to missing T-90 checkpoint"
                            
#                         # Missed T-60 Checkpoint
#                         elif minutes_until_shift <= 60 and t60 in ["missed", "pending"]:
#                             cancel_reason = "Auto-cancelled due to missing T-60 checkpoint"
                            
#                         if cancel_reason:
#                             print(f"[Cron] Worker missed checkpoint. Time left: {minutes_until_shift:.2f} mins. Cancelling assignment {a['job_assignment_id']}...")
#                             # Auto cancel this worker
#                             supabase.table("worker_job_assignments").update({
#                                 "assignment_status": "cancelled",
#                                 "t90_status": "missed" if "T-90" in cancel_reason else t90,
#                                 "t60_status": "missed" if "T-60" in cancel_reason else t60
#                             }).eq("job_assignment_id", a["job_assignment_id"]).execute()
#                             print(f"[Cron] Successfully cancelled worker assignment.")
                            
#                             # Check if manpower_requests is closed, if so, re-open it
#                             req_status = req_info.get("request_status")
#                             print(f"[Cron] Checking parent request status... currently '{req_status}'")
#                             if req_status == "closed":
#                                 print(f"[Cron] Parent request is closed. Re-opening request {a['request_id']}...")
#                                 supabase.table("manpower_requests").update({"request_status": "open"}).eq("request_id", a["request_id"]).execute()
#                                 print(f"[Cron] Successfully re-opened manpower request.")
                                
#                 except Exception as e:
#                     print(f"[Cron] Error processing shift date for assignment {a.get('job_assignment_id')}: {e}")
                    
#     except Exception as e:
#         print(f"[Cron] Error in check_t60_status: {e}")

def check_t90_voice_calls():
    """
    Cron job function to trigger Hunar.ai T-90 voice calls for pending shifts.
    """
    try:
        from jobs.t90_voice_worker import run_t90_worker_sync
        run_t90_worker_sync()
    except Exception as e:
        print(f"[Cron] Error in check_t90_voice_calls: {e}")

