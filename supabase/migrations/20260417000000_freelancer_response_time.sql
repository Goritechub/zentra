-- Track average response time for freelancers (computed from contract message threads)
ALTER TABLE freelancer_profiles
  ADD COLUMN IF NOT EXISTS avg_response_time_hours  NUMERIC         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_sample_count    INTEGER NOT NULL DEFAULT 0;
