-- A freelancer who never opened "Edit Profile" has no freelancer_profiles row,
-- so the stat-recalculation triggers -- which only UPDATE -- silently no-op for
-- them (0 rows matched) the moment they complete a job or get reviewed. That
-- freelancer's stats then never get tracked at all (see f0c6aebe).
--
-- Fix at the source: the two triggers that already own these writes now upsert
-- instead of blind-UPDATE, so a row is created automatically the first time
-- either stat has something to record. Same two events as before (a contract
-- completing, a review landing) -- no new trigger, no polling, no extra cost.

CREATE OR REPLACE FUNCTION public.recalculate_freelancer_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _avg_rating numeric;
BEGIN
  SELECT AVG(rating)::numeric(3,2)
  INTO _avg_rating
  FROM public.reviews
  WHERE reviewee_id = NEW.reviewee_id;

  INSERT INTO public.freelancer_profiles (user_id, rating, updated_at)
  VALUES (NEW.reviewee_id, COALESCE(_avg_rating, 0), now())
  ON CONFLICT (user_id) DO UPDATE
  SET rating = EXCLUDED.rating,
      updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_freelancer_completed_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _completed_count integer;
BEGIN
  SELECT COUNT(*) INTO _completed_count
  FROM public.contracts
  WHERE freelancer_id = NEW.freelancer_id AND status = 'completed';

  INSERT INTO public.freelancer_profiles (user_id, total_jobs_completed, updated_at)
  VALUES (NEW.freelancer_id, _completed_count, now())
  ON CONFLICT (user_id) DO UPDATE
  SET total_jobs_completed = EXCLUDED.total_jobs_completed,
      updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

-- One-time backfill:
-- (a) create rows for freelancers who already have a completed contract or a
--     review but no freelancer_profiles row yet (covers f0c6aebe today).
-- (b) recalculate rating for reviews that already existed before this and the
--     prior migration -- recalculate_freelancer_rating only ever ran on new
--     review INSERTs, so pre-existing reviews were never applied.
INSERT INTO public.freelancer_profiles (user_id, total_jobs_completed, rating, updated_at)
SELECT p.id,
       COALESCE((SELECT COUNT(*) FROM public.contracts c
                 WHERE c.freelancer_id = p.id AND c.status = 'completed'), 0),
       COALESCE((SELECT AVG(r.rating)::numeric(3,2) FROM public.reviews r
                 WHERE r.reviewee_id = p.id), 0),
       now()
FROM public.profiles p
WHERE p.role = 'freelancer'
  AND NOT EXISTS (SELECT 1 FROM public.freelancer_profiles fp WHERE fp.user_id = p.id)
  AND (
    EXISTS (SELECT 1 FROM public.contracts c WHERE c.freelancer_id = p.id AND c.status = 'completed')
    OR EXISTS (SELECT 1 FROM public.reviews r WHERE r.reviewee_id = p.id)
  );

ALTER TABLE public.freelancer_profiles DISABLE TRIGGER protect_freelancer_stats_trigger;

UPDATE public.freelancer_profiles fp
SET rating = COALESCE(
      (SELECT AVG(r.rating)::numeric(3,2) FROM public.reviews r WHERE r.reviewee_id = fp.user_id),
      0
    ),
    updated_at = now();

ALTER TABLE public.freelancer_profiles ENABLE TRIGGER protect_freelancer_stats_trigger;
