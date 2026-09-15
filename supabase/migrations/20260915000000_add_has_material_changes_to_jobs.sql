-- Documents a column added directly via the Supabase SQL editor (untracked until now).
-- Set true by JobsService.updateJob() when a client materially edits a job
-- (budget, delivery timeline, required skills, or required software changes)
-- while it has active proposals against it.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS has_material_changes BOOLEAN NOT NULL DEFAULT false;
