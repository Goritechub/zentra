
-- Table to store expert bank details for withdrawals
CREATE TABLE public.bank_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  recipient_code TEXT, -- Paystack transfer recipient code
  is_default BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, bank_code, account_number)
);

ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bank details"
  ON public.bank_details FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bank details"
  ON public.bank_details FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank details"
  ON public.bank_details FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank details"
  ON public.bank_details FOR DELETE USING (auth.uid() = user_id);

-- Table to track Paystack charge references and their states
CREATE TABLE public.paystack_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL, -- in kobo
  channel TEXT, -- card, bank, ussd
  status TEXT NOT NULL DEFAULT 'pending', -- pending, send_pin, send_otp, send_phone, send_birthday, send_address, success, failed
  paystack_response JSONB,
  purpose TEXT NOT NULL DEFAULT 'wallet_funding', -- wallet_funding, escrow_funding
  contract_id UUID REFERENCES public.contracts(id),
  milestone_id UUID REFERENCES public.milestones(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.paystack_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own paystack references"
  ON public.paystack_references FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own paystack references"
  ON public.paystack_references FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Table to track withdrawal requests
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- in kobo
  bank_detail_id UUID NOT NULL REFERENCES public.bank_details(id),
  transfer_code TEXT, -- Paystack transfer code
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, success, failed
  reason TEXT, -- failure reason
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own withdrawal requests"
  ON public.withdrawal_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_bank_details_updated_at
  BEFORE UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_paystack_references_updated_at
  BEFORE UPDATE ON public.paystack_references
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
