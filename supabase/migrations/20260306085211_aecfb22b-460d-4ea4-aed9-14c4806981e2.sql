-- Allow freelancers to delete their own contest entries
CREATE POLICY "Freelancers can delete own entries"
ON public.contest_entries
FOR DELETE
TO authenticated
USING (auth.uid() = freelancer_id);
