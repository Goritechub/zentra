
-- SAFETY CONSTRAINTS
ALTER TABLE public.wallets ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0);
ALTER TABLE public.wallets ADD CONSTRAINT wallets_escrow_balance_non_negative CHECK (escrow_balance >= 0);

-- Unique indexes for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_ledger_milestone_held ON public.escrow_ledger (milestone_id) WHERE status = 'held';
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_txn_reference_unique ON public.wallet_transactions (reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_contract_status ON public.escrow_ledger (contract_id, status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_milestone ON public.wallet_transactions (milestone_id) WHERE milestone_id IS NOT NULL;
