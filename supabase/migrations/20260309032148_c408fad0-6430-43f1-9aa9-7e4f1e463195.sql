
-- Allow dispute adjudicators to view contract messages
CREATE POLICY "Dispute adjudicators can view contract messages"
ON public.contract_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.contract_id = contract_messages.contract_id
      AND d.adjudicator_id = auth.uid()
      AND d.dispute_status IN ('under_review', 'awaiting_response')
  )
);

-- Allow dispute adjudicators to send messages in disputed contracts
CREATE POLICY "Dispute adjudicators can send messages"
ON public.contract_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.contract_id = contract_messages.contract_id
      AND d.adjudicator_id = auth.uid()
      AND d.dispute_status IN ('under_review', 'awaiting_response')
  )
);

-- Allow dispute adjudicators to view contract attachments
CREATE POLICY "Dispute adjudicators can view attachments"
ON public.contract_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.contract_id = contract_attachments.contract_id
      AND d.adjudicator_id = auth.uid()
      AND d.dispute_status IN ('under_review', 'awaiting_response')
  )
);

-- Allow dispute adjudicators to upload attachments
CREATE POLICY "Dispute adjudicators can upload attachments"
ON public.contract_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.contract_id = contract_attachments.contract_id
      AND d.adjudicator_id = auth.uid()
      AND d.dispute_status IN ('under_review', 'awaiting_response')
  )
);
