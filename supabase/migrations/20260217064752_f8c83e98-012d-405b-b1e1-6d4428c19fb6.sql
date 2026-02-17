
-- Add payment_type and milestones columns to proposals
ALTER TABLE public.proposals 
ADD COLUMN payment_type text NOT NULL DEFAULT 'project',
ADD COLUMN milestones jsonb DEFAULT '[]'::jsonb;

-- Add constraint for payment_type values
ALTER TABLE public.proposals 
ADD CONSTRAINT proposals_payment_type_check 
CHECK (payment_type IN ('project', 'milestone'));
