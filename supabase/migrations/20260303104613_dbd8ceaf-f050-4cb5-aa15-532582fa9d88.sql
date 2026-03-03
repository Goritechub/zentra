
-- 1. Add auth_code_hash to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_code_hash text DEFAULT NULL;

-- 2. Add unique constraint on username
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
  END IF;
END $$;

-- 3. Create comment_mentions table
CREATE TABLE IF NOT EXISTS public.comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.contest_comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentions viewable by everyone" ON public.comment_mentions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert mentions" ON public.comment_mentions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Allow contest owners to update entries (for nomination)
CREATE POLICY "Contest owners can update entries" ON public.contest_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_entries.contest_id AND c.client_id = auth.uid()
    )
  );

-- 5. Add entry visibility for open contests (everyone can see entries in open contests)
CREATE POLICY "Public entries viewable in open contests" ON public.contest_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_entries.contest_id AND c.visibility = 'open'
    )
  );
