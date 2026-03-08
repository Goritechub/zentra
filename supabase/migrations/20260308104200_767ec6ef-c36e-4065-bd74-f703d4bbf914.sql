
-- Step 1: Add 'status' column to wallet_transactions
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

-- Step 2: Update check constraint to include 'credit' and 'debit' types
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check 
  CHECK (type = ANY (ARRAY['deposit', 'withdrawal', 'escrow_lock', 'escrow_release', 'commission', 'refund', 'credit', 'debit']));

-- Step 3: Migrate unique records from transactions
INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description, reference, created_at, status)
SELECT 
  t.user_id,
  t.type,
  t.amount,
  0,
  t.description,
  t.reference,
  t.created_at,
  t.status
FROM public.transactions t
WHERE NOT EXISTS (
  SELECT 1 FROM public.wallet_transactions wt 
  WHERE wt.reference = t.reference AND t.reference IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM public.wallet_transactions wt
  WHERE wt.user_id = t.user_id 
    AND wt.amount = t.amount 
    AND wt.created_at = t.created_at
    AND t.reference IS NULL
);

-- Step 4: Drop the transactions table
DROP TABLE IF EXISTS public.transactions;
