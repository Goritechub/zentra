ALTER TABLE public.paystack_references
  ADD COLUMN IF NOT EXISTS paystack_fee INTEGER NOT NULL DEFAULT 0;
