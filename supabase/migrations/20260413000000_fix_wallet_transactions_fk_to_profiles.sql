-- Fix wallet_transactions.user_id FK to reference public.profiles instead of auth.users
-- This allows Supabase to perform the profile join in admin queries.
-- Since profiles.id mirrors auth.users.id, no data changes are needed.

ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
