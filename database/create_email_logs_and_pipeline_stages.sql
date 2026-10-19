-- ==============================================================================
-- Migration: Create Email Logs and Add Pipeline Progression Columns
-- ==============================================================================

-- 1. Create email_logs table for permanent email communication audit trail
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_code TEXT NOT NULL,
    submission_type TEXT NOT NULL,            -- 'Manager Submit' | 'Client Submission'
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    remarks TEXT,                             -- Custom notes/remarks added by HR
    candidates_count INT DEFAULT 0,
    candidates_snapshot JSONB DEFAULT '[]'::jsonb,
    sent_by TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'Sent',
    error_message TEXT,
    email_html_snippet TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_logs_job_code ON public.email_logs(job_code);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at DESC);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated access for email_logs
DROP POLICY IF EXISTS "Allow all for email_logs" ON public.email_logs;
CREATE POLICY "Allow all for email_logs"
    ON public.email_logs FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Add dynamic interview pipeline columns to tagged_candidates (if not exists)
ALTER TABLE public.tagged_candidates
    ADD COLUMN IF NOT EXISTS stage_outcome TEXT DEFAULT 'In Progress',
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS interview_history JSONB DEFAULT '[]'::jsonb;

-- Optional cleanup: Drop rejection_scope if you created it earlier (it is unnecessary since tagged_candidates is already job-scoped)
ALTER TABLE public.tagged_candidates DROP COLUMN IF EXISTS rejection_scope;

