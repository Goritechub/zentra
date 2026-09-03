-- FeaturedFreelancers on the homepage showed 0 completed jobs for freelancers who
-- had genuinely completed work. Two compounding causes:
--
-- 1. total_jobs_completed was set to the freelancer's *review count*
--    (recalculate_freelancer_rating trigger), not their real completed-contract
--    count. A completed job with no review yet always showed 0.
--
-- 2. Even that write was being silently reverted by protect_freelancer_stats_trigger
--    whenever the acting session wasn't an admin -- i.e. essentially always, since
--    reviews and milestone releases are submitted by ordinary clients/freelancers.
--    The admin-only bypass didn't account for writes cascading in from another
--    trigger (legitimate system recalculation), only for direct client writes.
--
-- Fix: derive total_jobs_completed from actual contracts.status = 'completed' rows
-- via a new trigger on contracts, keep the reviews trigger scoped to rating only,
-- and let protect_freelancer_stats_trigger allow nested/trigger-originated writes
-- (pg_trigger_depth() > 1) while still blocking direct top-level client tampering
-- (depth = 1, e.g. a freelancer PATCHing their own row via the existing RLS policy).

CREATE OR REPLACE FUNCTION public.protect_freelancer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Admins, and writes cascading in from another trigger (system recalculation),
  -- are allowed through. Only a direct top-level write gets reverted.
  IF public.has_role(auth.uid(), 'admin') OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.rating IS DISTINCT FROM OLD.rating THEN
    NEW.rating := OLD.rating;
  END IF;
  IF NEW.total_jobs_completed IS DISTINCT FROM OLD.total_jobs_completed THEN
    NEW.total_jobs_completed := OLD.total_jobs_completed;
  END IF;

  RETURN NEW;
END;
$$;

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

  UPDATE public.freelancer_profiles
  SET rating = COALESCE(_avg_rating, 0),
      updated_at = now()
  WHERE user_id = NEW.reviewee_id;

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

  UPDATE public.freelancer_profiles
  SET total_jobs_completed = _completed_count,
      updated_at = now()
  WHERE user_id = NEW.freelancer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recalculate_completed_jobs_on_contract_completion ON public.contracts;
CREATE TRIGGER recalculate_completed_jobs_on_contract_completion
  AFTER UPDATE ON public.contracts
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.recalculate_freelancer_completed_jobs();

-- One-time backfill so existing freelancers reflect their real completed-contract
-- count immediately, rather than waiting on their next contract to complete.
ALTER TABLE public.freelancer_profiles DISABLE TRIGGER protect_freelancer_stats_trigger;

UPDATE public.freelancer_profiles fp
SET total_jobs_completed = (
      SELECT COUNT(*) FROM public.contracts c
      WHERE c.freelancer_id = fp.user_id AND c.status = 'completed'
    ),
    updated_at = now();

ALTER TABLE public.freelancer_profiles ENABLE TRIGGER protect_freelancer_stats_trigger;
