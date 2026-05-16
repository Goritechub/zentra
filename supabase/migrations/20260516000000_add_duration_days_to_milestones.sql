ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS duration_days INTEGER;
