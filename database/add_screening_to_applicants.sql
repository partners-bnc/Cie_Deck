-- Add screening column to store JSON array of HR screening records
-- Each record contains: {"hr_name": "...", "screened_at": "..."}

ALTER TABLE applicants
ADD COLUMN IF NOT EXISTS screening JSONB DEFAULT '[]'::jsonb;

-- Optional index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_applicants_screening ON applicants USING gin (screening);
