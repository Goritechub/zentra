-- Allow admins to delete contests
CREATE POLICY "Admins can delete contests"
  ON public.contests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update contests
CREATE POLICY "Admins can update contests"
  ON public.contests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete contest entries
CREATE POLICY "Admins can delete contest entries"
  ON public.contest_entries FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete contest comments
CREATE POLICY "Admins can delete contest comments"
  ON public.contest_comments FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete contest follows
CREATE POLICY "Admins can delete contest follows"
  ON public.contest_follows FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));