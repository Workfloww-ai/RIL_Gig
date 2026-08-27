-- Migration: Create payments table and add finance role
-- Run this in your Supabase SQL Editor for the SahYogi project

-- 1. Create the payments table
CREATE TABLE IF NOT EXISTS public.payments (
  payment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_assignment_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  payment_status character varying NOT NULL DEFAULT 'pending',
  upi_id character varying,
  payment_method character varying DEFAULT 'upi',
  transaction_reference character varying,
  processed_by uuid,
  processed_at timestamp with time zone,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (payment_id),
  CONSTRAINT fk_payments_assignment FOREIGN KEY (job_assignment_id)
    REFERENCES public.worker_job_assignments(job_assignment_id),
  CONSTRAINT fk_payments_worker FOREIGN KEY (worker_id)
    REFERENCES public.users(user_id),
  CONSTRAINT fk_payments_processed_by FOREIGN KEY (processed_by)
    REFERENCES public.users(user_id),
  CONSTRAINT unique_payment_per_assignment UNIQUE (job_assignment_id)
);

-- 2. Add finance role (idempotent)
INSERT INTO public.roles (role_name, hierarchy_level, description)
SELECT 'finance', 3, 'Finance team member responsible for processing worker payments'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE role_name = 'finance');

-- 3. Create index for faster payment queries
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_worker ON public.payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_payments_processed_at ON public.payments(processed_at);
