
-- Job views tracking table
CREATE TABLE public.job_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one view per user per job
CREATE UNIQUE INDEX idx_job_views_unique ON public.job_views (job_id, viewer_id);

-- Enable RLS
ALTER TABLE public.job_views ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert views
CREATE POLICY "Authenticated users can record views"
  ON public.job_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);

-- Job owners can see views on their jobs
CREATE POLICY "Job owners can view counts"
  ON public.job_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id = job_views.job_id AND j.client_id = auth.uid()
    )
    OR auth.uid() = viewer_id
  );
