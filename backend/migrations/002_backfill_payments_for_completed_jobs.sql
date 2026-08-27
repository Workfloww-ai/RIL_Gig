-- Migration: Backfill payments for existing completed jobs
-- Run this in your Supabase SQL Editor

INSERT INTO public.payments (
    job_assignment_id, 
    worker_id, 
    amount, 
    payment_status, 
    upi_id
)
SELECT 
    wja.job_assignment_id, 
    wja.worker_id, 
    COALESCE(mr.hours_duration * j.base_compensation, 0) AS amount, 
    'pending' AS payment_status,
    u.upi_id
FROM public.worker_job_assignments wja
JOIN public.manpower_requests mr ON wja.request_id = mr.request_id
JOIN public.jobs j ON mr.job_id = j.job_id
JOIN public.users u ON wja.worker_id = u.user_id
WHERE wja.assignment_status = 'completed'
AND NOT EXISTS (
    -- Ensure we don't create duplicate payment records
    SELECT 1 FROM public.payments p WHERE p.job_assignment_id = wja.job_assignment_id
);
