ALTER TABLE public.contract_messages
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
