-- Add structured block content and category to blog_posts.
-- `content` is kept as-is: it becomes the always-plain-text flattened
-- representation of `blocks`, used for search (.ilike) and OG/SEO excerpts.
-- `blocks` is nullable so existing rows (plain-text-only) keep working via
-- the frontend's fallback renderer with no backfill required.

alter table public.blog_posts
  add column if not exists blocks jsonb,
  add column if not exists category text,
  add column if not exists blocks_schema_version integer not null default 1;

comment on column public.blog_posts.blocks is
  'Structured block content: array of {id, type: h1|h2|h3|paragraph|caption|blockquote|code|bullet_list|numbered_list|image, text?, items?, url?, alt?, language?}. Null for legacy plain-text-only posts (pre-dates this column). Shape versioned by blocks_schema_version (id field added in version 2).';
comment on column public.blog_posts.category is
  'Blog category slug, see src/lib/blogCategories.ts. Nullable. Not a DB enum/CHECK constraint by design — validated in the backend app layer only, matching how tags is handled.';
comment on column public.blog_posts.blocks_schema_version is
  'Version of the blocks jsonb shape this row was written with, so future block-shape changes can branch/migrate per row instead of guessing from content.';

create index if not exists blog_posts_category_idx on public.blog_posts (category);
