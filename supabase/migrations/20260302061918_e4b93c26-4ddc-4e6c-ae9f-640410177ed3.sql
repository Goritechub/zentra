
-- Contest comments table with threaded replies and likes
CREATE TABLE public.contest_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.contest_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contest_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contest comments viewable by everyone"
  ON public.contest_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can post comments"
  ON public.contest_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON public.contest_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.contest_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Contest comment likes
CREATE TABLE public.contest_comment_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.contest_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.contest_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by everyone"
  ON public.contest_comment_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like"
  ON public.contest_comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
  ON public.contest_comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Add is_nominee column to contest_entries for nominee stage
ALTER TABLE public.contest_entries ADD COLUMN IF NOT EXISTS is_nominee BOOLEAN DEFAULT false;

-- Add 'selecting_winners' as valid contest status (it's text so no enum change needed)
-- Contests can now have statuses: active, selecting_winners, ended/completed
