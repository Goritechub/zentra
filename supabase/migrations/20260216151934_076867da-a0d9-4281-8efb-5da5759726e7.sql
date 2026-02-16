-- Add overall skill level requirement to jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS skill_level text DEFAULT 'Intermediate';
