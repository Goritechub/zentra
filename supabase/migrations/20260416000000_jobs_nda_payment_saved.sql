-- Add NDA and payment_ready flags to jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS is_nda       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_ready BOOLEAN NOT NULL DEFAULT false;

-- Saved jobs table (per-user bookmarks, persisted)
CREATE TABLE IF NOT EXISTS saved_jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id     UUID NOT NULL REFERENCES jobs(id)       ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user  ON saved_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job   ON saved_jobs (job_id);

-- RLS
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved jobs"
  ON saved_jobs
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
