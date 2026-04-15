-- Add cancellation reason fields to contests table
ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_note text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
