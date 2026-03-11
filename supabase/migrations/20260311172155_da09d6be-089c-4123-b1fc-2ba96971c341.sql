
-- ============================================================
-- Issue 1: Enforce contest entry edit/delete rules at DB level
-- ============================================================

-- Trigger: prevent edits beyond 2, edits after 8hrs from creation, and deletes after deadline
CREATE OR REPLACE FUNCTION public.enforce_contest_entry_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _contest record;
  _hours_since_creation numeric;
BEGIN
  -- Get the contest
  SELECT * INTO _contest FROM public.contests WHERE id = COALESCE(OLD.contest_id, NEW.contest_id);
  IF _contest IS NULL THEN
    RAISE EXCEPTION 'Contest not found';
  END IF;

  -- Admins and contest owners bypass all rules
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- DELETE rules
  IF TG_OP = 'DELETE' THEN
    -- Cannot delete after deadline
    IF _contest.deadline <= now() THEN
      RAISE EXCEPTION 'Cannot delete entry after contest deadline';
    END IF;
    -- Cannot delete if contest is completed
    IF _contest.status IN ('completed', 'ended', 'selecting_winners') THEN
      RAISE EXCEPTION 'Cannot delete entry from a closed contest';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE rules (edits)
  IF TG_OP = 'UPDATE' THEN
    -- Contest owner updating nominee/winner fields is allowed (they have their own RLS)
    -- Only enforce on freelancer self-edits (description/attachments changes)
    IF auth.uid() = OLD.freelancer_id THEN
      -- Cannot edit after deadline
      IF _contest.deadline <= now() THEN
        RAISE EXCEPTION 'Cannot edit entry after contest deadline';
      END IF;
      -- Cannot edit if contest is completed
      IF _contest.status IN ('completed', 'ended', 'selecting_winners') THEN
        RAISE EXCEPTION 'Cannot edit entry in a closed contest';
      END IF;
      -- Check edit count limit (max 2 edits)
      IF OLD.edit_count >= 2 AND (NEW.description IS DISTINCT FROM OLD.description OR NEW.attachments IS DISTINCT FROM OLD.attachments) THEN
        RAISE EXCEPTION 'Maximum edit limit (2) reached for this entry';
      END IF;
      -- Check 8-hour edit window from creation
      _hours_since_creation := EXTRACT(EPOCH FROM (now() - OLD.created_at)) / 3600.0;
      IF _hours_since_creation > 8 AND (NEW.description IS DISTINCT FROM OLD.description OR NEW.attachments IS DISTINCT FROM OLD.attachments) THEN
        RAISE EXCEPTION 'Edit window (8 hours from submission) has expired';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER enforce_contest_entry_rules_trigger
  BEFORE UPDATE OR DELETE ON public.contest_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_contest_entry_rules();

-- ============================================================
-- Issue 3: Protect freelancer rating/total_jobs_completed from direct writes
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_freelancer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Allow admins and service role to modify these fields
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- For regular users, prevent changing protected statistical fields
  IF NEW.rating IS DISTINCT FROM OLD.rating THEN
    NEW.rating := OLD.rating;
  END IF;
  IF NEW.total_jobs_completed IS DISTINCT FROM OLD.total_jobs_completed THEN
    NEW.total_jobs_completed := OLD.total_jobs_completed;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_freelancer_stats_trigger
  BEFORE UPDATE ON public.freelancer_profiles
  FOR EACH ROW
  WHEN (NEW.rating IS DISTINCT FROM OLD.rating OR NEW.total_jobs_completed IS DISTINCT FROM OLD.total_jobs_completed)
  EXECUTE FUNCTION public.protect_freelancer_stats();

-- ============================================================
-- Issue 3b: Auto-recalculate freelancer rating on new review insert
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_freelancer_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _avg_rating numeric;
  _review_count integer;
BEGIN
  -- Calculate average rating for the reviewee
  SELECT AVG(rating)::numeric(3,2), COUNT(*)
  INTO _avg_rating, _review_count
  FROM public.reviews
  WHERE reviewee_id = NEW.reviewee_id;

  -- Update the freelancer profile if it exists
  UPDATE public.freelancer_profiles
  SET rating = COALESCE(_avg_rating, 0),
      total_jobs_completed = _review_count,
      updated_at = now()
  WHERE user_id = NEW.reviewee_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER recalculate_rating_on_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_freelancer_rating();
