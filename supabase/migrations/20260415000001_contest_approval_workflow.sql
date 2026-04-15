-- Add review columns to contests table
ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS review_message text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id);

-- Create cancellation requests table
CREATE TABLE IF NOT EXISTS public.contest_cancellation_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_id uuid REFERENCES public.profiles(id),
  admin_message text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
