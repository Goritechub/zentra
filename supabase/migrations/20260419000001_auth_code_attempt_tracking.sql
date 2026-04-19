-- Add attempt tracking and reset token support to auth_codes
ALTER TABLE public.auth_codes
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS reset_token_hash text,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;
