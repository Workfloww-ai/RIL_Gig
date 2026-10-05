import pytest
import asyncio
import uuid
from db.finance_db import create_payment_record
from utils.supabase_client import supabase

@pytest.mark.asyncio
async def test_payment_concurrency():
    # Fetch an existing assignment to satisfy FK constraints
    res = supabase.table("worker_job_assignments").select("job_assignment_id, worker_id").limit(1).execute()
    if not res.data:
        pytest.skip("No assignments in DB to test with")
    job_id = res.data[0]["job_assignment_id"]
    worker_id = res.data[0]["worker_id"]
    
    # Ensure no existing payments for this assignment
    supabase.table("payments").delete().eq("job_assignment_id", job_id).execute()
        
    async def make_request():
        return await asyncio.to_thread(create_payment_record, job_id, worker_id, 100.0)

    # Send 2 simultaneous requests
    res1, res2 = await asyncio.gather(make_request(), make_request(), return_exceptions=True)
    
    # Verify DB
    db_check = supabase.table("payments").select("*").eq("job_assignment_id", job_id).execute()
    print("RES1:", res1)
    print("RES2:", res2)
    assert len(db_check.data) == 1, f"Expected 1 payment, got {len(db_check.data)}. Concurrency failed!"
