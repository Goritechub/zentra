-- Allow admins to delete related proposals
CREATE POLICY "Admins can delete proposals"
  ON public.proposals FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete job views
CREATE POLICY "Admins can delete job views"
  ON public.job_views FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));