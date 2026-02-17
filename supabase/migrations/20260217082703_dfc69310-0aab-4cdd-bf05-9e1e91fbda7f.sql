-- Add delivery_unit column to proposals (days, weeks, months)
ALTER TABLE public.proposals ADD COLUMN delivery_unit text NOT NULL DEFAULT 'days';