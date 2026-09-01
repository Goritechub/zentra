-- Tracks freelancer agreement to a job's IP Policy, enforced server-side
-- to gate full job details behind agreement when jobs.is_ip_policy = true.
CREATE TABLE IF NOT EXISTS job_ip_policy_agreements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES jobs(id)       ON DELETE CASCADE,
  freelancer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, freelancer_id)
);

CREATE INDEX IF NOT EXISTS idx_job_ip_policy_agreements_job         ON job_ip_policy_agreements (job_id);
CREATE INDEX IF NOT EXISTS idx_job_ip_policy_agreements_freelancer  ON job_ip_policy_agreements (freelancer_id);

ALTER TABLE job_ip_policy_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own IP policy agreements"
  ON job_ip_policy_agreements
  USING  (auth.uid() = freelancer_id)
  WITH CHECK (auth.uid() = freelancer_id);
