-- Migration: Add bidirectional links between client_jobs (JPC) and jobs (Portal Job Listings)
-- Run this in your Supabase SQL Editor

ALTER TABLE public.client_jobs 
  ADD COLUMN IF NOT EXISTS portal_job_id bigint;

ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS jpc_code text;

CREATE INDEX IF NOT EXISTS idx_client_jobs_portal_job_id 
  ON public.client_jobs (portal_job_id);

CREATE INDEX IF NOT EXISTS idx_jobs_jpc_code 
  ON public.jobs (jpc_code);
