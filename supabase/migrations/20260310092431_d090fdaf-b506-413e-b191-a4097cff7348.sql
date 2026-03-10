
-- LOCK DOWN FINANCIAL TABLES: Remove all user write policies
-- All writes go through SECURITY DEFINER RPCs which bypass RLS

-- WALLETS: Users should NOT directly update their balance
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can create own wallet" ON public.wallets;

-- ESCROW_LEDGER: No direct user writes
DROP POLICY IF EXISTS "Authenticated users can insert escrow ledger" ON public.escrow_ledger;
DROP POLICY IF EXISTS "Authenticated users can update escrow ledger" ON public.escrow_ledger;

-- PAYOUT_TRANSFERS: No direct user writes
DROP POLICY IF EXISTS "Authenticated users can insert payout transfers" ON public.payout_transfers;
DROP POLICY IF EXISTS "Authenticated users can update payout transfers" ON public.payout_transfers;

-- WALLET_TRANSACTIONS: No direct user inserts
DROP POLICY IF EXISTS "Authenticated inserts wallet transactions" ON public.wallet_transactions;
