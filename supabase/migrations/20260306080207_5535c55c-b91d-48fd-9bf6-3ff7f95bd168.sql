
-- Add prize_fourth and prize_fifth columns to contests
ALTER TABLE public.contests ADD COLUMN IF NOT EXISTS prize_fourth integer DEFAULT 0;
ALTER TABLE public.contests ADD COLUMN IF NOT EXISTS prize_fifth integer DEFAULT 0;

-- Add justification column to contest_entries (for winner selection)
ALTER TABLE public.contests ADD COLUMN IF NOT EXISTS winner_justifications jsonb DEFAULT '{}'::jsonb;

-- Create verification_requests table
CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view own verification request
CREATE POLICY "Users can view own verification request"
  ON public.verification_requests FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Users can insert verification request
CREATE POLICY "Users can insert verification request"
  ON public.verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can update verification requests
CREATE POLICY "Admins can update verification requests"
  ON public.verification_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add edit tracking to contest_entries
ALTER TABLE public.contest_entries ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.contest_entries ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for avatars bucket
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
