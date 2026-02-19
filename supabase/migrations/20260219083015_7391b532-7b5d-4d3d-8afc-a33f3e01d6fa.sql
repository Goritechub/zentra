
-- Escrow Ledger: tracks held/released/refunded amounts per contract+milestone
CREATE TABLE public.escrow_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  held_amount integer NOT NULL DEFAULT 0,
  released_amount integer NOT NULL DEFAULT 0,
  platform_fee integer NOT NULL DEFAULT 0,
  expert_amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'held',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.escrow_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contract participants can view escrow ledger"
  ON public.escrow_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = escrow_ledger.contract_id
      AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all escrow ledger"
  ON public.escrow_ledger FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert escrow ledger"
  ON public.escrow_ledger FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update escrow ledger"
  ON public.escrow_ledger FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Payout Transfers: tracks Paystack transfers to experts
CREATE TABLE public.payout_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  expert_id uuid NOT NULL,
  transfer_code text,
  amount integer NOT NULL,
  platform_fee integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  initiated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  paystack_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Experts can view own payout transfers"
  ON public.payout_transfers FOR SELECT
  USING (auth.uid() = expert_id);

CREATE POLICY "Contract participants can view payout transfers"
  ON public.payout_transfers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = payout_transfers.contract_id
      AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all payout transfers"
  ON public.payout_transfers FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert payout transfers"
  ON public.payout_transfers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update payout transfers"
  ON public.payout_transfers FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Add 'paid' to milestone status options (no enum, it's text)
-- Add gateway_response to paystack_references for raw response storage
ALTER TABLE public.paystack_references ADD COLUMN IF NOT EXISTS gateway_response text;

-- Enable realtime for escrow_ledger
ALTER PUBLICATION supabase_realtime ADD TABLE public.escrow_ledger;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payout_transfers;
