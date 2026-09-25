import os
import asyncio
from dotenv import load_dotenv

# Load env before importing supabase
load_dotenv()

from utils.supabase_client import supabase
from datetime import datetime, timedelta, timezone

async def make_job_no_show():
    # Use the job ID we've been working with
    job_id = "8ac364bc-0303-4f4e-8c65-f3bebbab9bcc"
    
    IST = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(IST)
    
    # Set the shift start time to 1 hour ago
    past_time = now - timedelta(hours=1)
    shift_date = past_time.strftime("%Y-%m-%d")
    start_time = past_time.strftime("%H:%M:%S")

    print(f"Updating job {job_id} to shift_date={shift_date}, start_time={start_time}")
    
    res = supabase.table("manpower_requests").update({
        "shift_date": shift_date,
        "start_time": start_time
    }).eq("request_id", job_id).execute()
    
    print("Update response:", res.data)
    
if __name__ == "__main__":
    asyncio.run(make_job_no_show())
