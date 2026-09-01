-- Add job-specific IP Policy flags, mirroring is_nda/nda_url
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS is_ip_policy   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ip_policy_type TEXT    NULL,  -- 'standard' | 'custom'
  ADD COLUMN IF NOT EXISTS ip_policy_url  TEXT    NULL;  -- set only when ip_policy_type = 'custom'
