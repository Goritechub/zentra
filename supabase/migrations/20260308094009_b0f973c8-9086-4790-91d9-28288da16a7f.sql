
-- Add new columns to disputes table for full resolution workflow
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS dispute_status text NOT NULL DEFAULT 'awaiting_response',
  ADD COLUMN IF NOT EXISTS respondent_id uuid,
  ADD COLUMN IF NOT EXISTS respondent_explanation text,
  ADD COLUMN IF NOT EXISTS respondent_evidence_urls text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS response_deadline timestamp with time zone,
  ADD COLUMN IF NOT EXISTS adjudicator_id uuid,
  ADD COLUMN IF NOT EXISTS adjudicator_assigned_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS resolution_type text,
  ADD COLUMN IF NOT EXISTS resolution_explanation text,
  ADD COLUMN IF NOT EXISTS resolution_split_client integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resolution_split_freelancer integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resolved_by uuid;

-- Update existing open disputes to use new status field
UPDATE public.disputes SET dispute_status = 'resolved' WHERE status IN ('resolved_client', 'resolved_freelancer');
UPDATE public.disputes SET dispute_status = 'awaiting_response' WHERE status = 'open';
