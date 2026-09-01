-- reverse_withdrawal_atomic() (20260310082142_reverse_withdrawal_atomic.sql) inserts
-- wallet_transactions rows with type = 'reversal', but that type was never added to
-- wallet_transactions_type_check, so admin withdrawal cancellations fail with:
-- "new row for relation wallet_transactions violates check constraint wallet_transactions_type_check"

ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type = ANY (ARRAY['deposit', 'withdrawal', 'escrow_lock', 'escrow_release', 'commission', 'refund', 'credit', 'debit', 'reversal']));
