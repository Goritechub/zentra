-- Add pending_clearance to wallets
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS pending_clearance integer NOT NULL DEFAULT 0;

-- Add clearance_at to wallet_transactions (when funds become available)
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS clearance_at timestamptz DEFAULT NULL;

-- Add withdrawals_frozen platform setting check (done via platform_settings table, no schema change needed)
