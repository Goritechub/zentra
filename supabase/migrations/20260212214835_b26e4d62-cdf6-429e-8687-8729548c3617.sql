
-- Allow clients to update proposals on their jobs (for interview/accept/reject)
CREATE POLICY "Clients can update proposals on their jobs"
ON public.proposals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM jobs
    WHERE jobs.id = proposals.job_id
    AND jobs.client_id = auth.uid()
  )
);
