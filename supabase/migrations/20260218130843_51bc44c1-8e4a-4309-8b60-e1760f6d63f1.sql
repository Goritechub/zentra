
-- ============================================
-- CONTRACT-CENTRIC ARCHITECTURE MIGRATION
-- ============================================

-- 1. Expand contract_status enum with new lifecycle states
ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'pending_funding';
ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'in_review';

-- 2. Add snapshot columns to contracts (store original job & proposal data)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS job_description text,
  ADD COLUMN IF NOT EXISTS job_category text,
  ADD COLUMN IF NOT EXISTS job_budget_min integer,
  ADD COLUMN IF NOT EXISTS job_budget_max integer,
  ADD COLUMN IF NOT EXISTS job_delivery_days integer,
  ADD COLUMN IF NOT EXISTS job_delivery_unit text DEFAULT 'days',
  ADD COLUMN IF NOT EXISTS job_attachments text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accepted_cover_letter text,
  ADD COLUMN IF NOT EXISTS accepted_bid_amount integer,
  ADD COLUMN IF NOT EXISTS accepted_attachments text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accepted_payment_type text DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS terms_conditions text;

-- 3. Create contract_messages table (replaces general messages for contract context)
CREATE TABLE public.contract_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  is_system_message boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create contract_attachments table
CREATE TABLE public.contract_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.contract_messages(id) ON DELETE SET NULL,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  context text NOT NULL DEFAULT 'chat', -- chat, proposal, milestone, dispute
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create milestone_submissions table
CREATE TABLE public.milestone_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  notes text,
  attachments text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Create escrow_transactions table
CREATE TABLE public.escrow_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  payer_id uuid NOT NULL,
  payee_id uuid,
  amount integer NOT NULL,
  type text NOT NULL, -- fund, release, refund
  status text NOT NULL DEFAULT 'pending',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Enable RLS on all new tables
ALTER TABLE public.contract_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

-- 8. RLS: contract_messages — participants can read/write
CREATE POLICY "Contract participants can view messages"
ON public.contract_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.contracts c
  WHERE c.id = contract_messages.contract_id
  AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
));

CREATE POLICY "Contract participants can send messages"
ON public.contract_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_messages.contract_id
    AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
  )
);

CREATE POLICY "Senders can update own messages"
ON public.contract_messages FOR UPDATE
USING (auth.uid() = sender_id);

CREATE POLICY "Receivers can mark messages read"
ON public.contract_messages FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.contracts c
  WHERE c.id = contract_messages.contract_id
  AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
));

CREATE POLICY "Admins can view all contract messages"
ON public.contract_messages FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. RLS: contract_attachments
CREATE POLICY "Contract participants can view attachments"
ON public.contract_attachments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.contracts c
  WHERE c.id = contract_attachments.contract_id
  AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
));

CREATE POLICY "Contract participants can upload attachments"
ON public.contract_attachments FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_attachments.contract_id
    AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
  )
);

CREATE POLICY "Admins can view all attachments"
ON public.contract_attachments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 10. RLS: milestone_submissions
CREATE POLICY "Contract participants can view submissions"
ON public.milestone_submissions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.contracts c
  WHERE c.id = milestone_submissions.contract_id
  AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
));

CREATE POLICY "Freelancers can create submissions"
ON public.milestone_submissions FOR INSERT
WITH CHECK (
  auth.uid() = submitted_by
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = milestone_submissions.contract_id
    AND c.freelancer_id = auth.uid()
  )
);

CREATE POLICY "Contract participants can update submissions"
ON public.milestone_submissions FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.contracts c
  WHERE c.id = milestone_submissions.contract_id
  AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
));

-- 11. RLS: escrow_transactions
CREATE POLICY "Contract participants can view escrow"
ON public.escrow_transactions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.contracts c
  WHERE c.id = escrow_transactions.contract_id
  AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
));

CREATE POLICY "Authenticated users can create escrow txn"
ON public.escrow_transactions FOR INSERT
WITH CHECK (auth.uid() = payer_id);

CREATE POLICY "Admins can view all escrow"
ON public.escrow_transactions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 12. Enable realtime for contract_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_messages;

-- 13. Drop old messages data (user chose to drop old data)
TRUNCATE public.messages CASCADE;

-- 14. Create storage bucket for contract attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-attachments', 'contract-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Contract participants can upload files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contract-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Contract files are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'contract-attachments');
