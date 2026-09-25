-- First full-text search in this schema. Replaces the .ilike substring search
-- in blog.service.ts's getPosts() with a proper tsvector + GIN index, weighted
-- so title matches rank above body matches.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS blog_posts_search_vector_idx ON public.blog_posts USING GIN (search_vector);
