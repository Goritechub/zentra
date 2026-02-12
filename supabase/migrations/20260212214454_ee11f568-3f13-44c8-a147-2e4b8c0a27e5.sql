
-- Add "interviewing" to proposal_status enum
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'interviewing' AFTER 'pending';
