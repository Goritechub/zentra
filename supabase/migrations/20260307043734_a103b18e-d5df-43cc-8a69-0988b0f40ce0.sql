
CREATE OR REPLACE FUNCTION public.get_contest_entry_count(_contest_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.contest_entries
  WHERE contest_id = _contest_id
$$;
