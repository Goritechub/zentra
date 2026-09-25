-- Server-backed tag facets with counts for the blog, computed from published
-- posts only. Mirrors the get_contest_entry_count() precedent: a small
-- SECURITY DEFINER SQL function called via supabase.rpc() from the backend,
-- rather than deriving tags client-side from whatever page happens to be loaded.
CREATE OR REPLACE FUNCTION public.get_blog_tag_facets()
RETURNS TABLE (tag text, count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.tag, COUNT(*)::integer AS count
  FROM public.blog_posts p, unnest(p.tags) AS t(tag)
  WHERE p.status = 'published'
  GROUP BY t.tag
  ORDER BY count DESC, t.tag ASC
$$;
