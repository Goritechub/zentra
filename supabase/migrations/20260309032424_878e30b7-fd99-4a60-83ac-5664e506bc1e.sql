
-- Create dispute messages table
CREATE TABLE public.dispute_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_system_message BOOLEAN NOT NULL DEFAULT false,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- Dispute participants (raiser, respondent) can view messages
CREATE POLICY "Dispute parties can view messages"
ON public.dispute_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = dispute_messages.dispute_id
      AND (d.raised_by = auth.uid() OR d.respondent_id = auth.uid())
  )
);

-- Adjudicator can view messages
CREATE POLICY "Adjudicator can view dispute messages"
ON public.dispute_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = dispute_messages.dispute_id
      AND d.adjudicator_id = auth.uid()
  )
);

-- Admins can view all dispute messages
CREATE POLICY "Admins can view all dispute messages"
ON public.dispute_messages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Dispute parties can send messages (only while dispute is active)
CREATE POLICY "Dispute parties can send messages"
ON public.dispute_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = dispute_messages.dispute_id
      AND (d.raised_by = auth.uid() OR d.respondent_id = auth.uid())
      AND d.dispute_status IN ('awaiting_response', 'under_review')
  )
);

-- Adjudicator can send messages
CREATE POLICY "Adjudicator can send dispute messages"
ON public.dispute_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = dispute_messages.dispute_id
      AND d.adjudicator_id = auth.uid()
      AND d.dispute_status IN ('awaiting_response', 'under_review')
  )
);

-- Parties can mark messages as read
CREATE POLICY "Users can mark dispute messages read"
ON public.dispute_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = dispute_messages.dispute_id
      AND (d.raised_by = auth.uid() OR d.respondent_id = auth.uid() OR d.adjudicator_id = auth.uid())
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_messages;

-- Create index for performance
CREATE INDEX idx_dispute_messages_dispute_id ON public.dispute_messages(dispute_id);
CREATE INDEX idx_dispute_messages_created_at ON public.dispute_messages(dispute_id, created_at);

-- Remove the contract_messages adjudicator policies we added previously (wrong approach)
DROP POLICY IF EXISTS "Dispute adjudicators can view contract messages" ON public.contract_messages;
DROP POLICY IF EXISTS "Dispute adjudicators can send messages" ON public.contract_messages;
DROP POLICY IF EXISTS "Dispute adjudicators can view attachments" ON public.contract_attachments;
DROP POLICY IF EXISTS "Dispute adjudicators can upload attachments" ON public.contract_attachments;
