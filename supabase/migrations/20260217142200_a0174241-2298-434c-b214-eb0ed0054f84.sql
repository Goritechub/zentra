
-- Add delivery_unit to jobs table (days/weeks/months)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_unit TEXT NOT NULL DEFAULT 'days';

-- Add submission fields to milestones for the review flow
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS submission_notes TEXT;
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS submission_attachments TEXT[] DEFAULT '{}'::text[];

-- Add visibility and invited experts to jobs for private/public contracts
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS invited_expert_ids UUID[] DEFAULT '{}'::uuid[];
