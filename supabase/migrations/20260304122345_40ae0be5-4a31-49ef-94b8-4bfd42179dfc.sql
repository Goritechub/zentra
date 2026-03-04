
-- Add deadline_extended_once flag to contests
ALTER TABLE public.contests ADD COLUMN IF NOT EXISTS deadline_extended_once boolean NOT NULL DEFAULT false;

-- Create contest_follows table
CREATE TABLE IF NOT EXISTS public.contest_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contest_id, user_id)
);

ALTER TABLE public.contest_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can follow contests" ON public.contest_follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow contests" ON public.contest_follows
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Follows viewable by everyone" ON public.contest_follows
  FOR SELECT TO authenticated USING (true);
