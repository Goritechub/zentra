
-- Platform reviews table
CREATE TABLE public.platform_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  is_approved boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  contracts_at_review integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one review per user
ALTER TABLE public.platform_reviews ADD CONSTRAINT platform_reviews_user_id_key UNIQUE (user_id);

-- RLS
ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved reviews (for homepage)
CREATE POLICY "Approved reviews viewable by everyone"
  ON public.platform_reviews FOR SELECT
  USING (is_approved = true);

-- Users can view own review
CREATE POLICY "Users can view own platform review"
  ON public.platform_reviews FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all platform reviews"
  ON public.platform_reviews FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert own review
CREATE POLICY "Users can insert own platform review"
  ON public.platform_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update own review
CREATE POLICY "Users can update own platform review"
  ON public.platform_reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can update (approve/feature)
CREATE POLICY "Admins can update platform reviews"
  ON public.platform_reviews FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete
CREATE POLICY "Admins can delete platform reviews"
  ON public.platform_reviews FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
