-- Editorial lifecycle for blog_posts: replace the is_published boolean with a real
-- status state machine, add scheduling/review columns, and an insert-only revision
-- history table. Column naming mirrors the existing contests approval workflow
-- (20260415000001_contest_approval_workflow.sql): reviewed_at / reviewed_by / review_message.

alter table public.blog_posts
  add column if not exists status text not null default 'draft',
  add column if not exists published_at timestamptz,
  add column if not exists scheduled_for timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists review_message text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.blog_posts
  drop constraint if exists blog_posts_status_check;
alter table public.blog_posts
  add constraint blog_posts_status_check
  check (status in ('draft', 'submitted', 'changes_requested', 'scheduled', 'published', 'archived'));

-- Backfill: every existing row was already submitted for moderation the moment it was
-- created (there was no separate "draft" state before this migration), so is_published
-- false/true map to submitted/published rather than draft/published.
update public.blog_posts
  set status = case when is_published then 'published' else 'submitted' end,
      published_at = case when is_published then created_at else null end
  where status = 'draft';

drop trigger if exists update_blog_posts_updated_at on public.blog_posts;
create trigger update_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.update_updated_at_column();

comment on column public.blog_posts.is_published is
  'Deprecated, superseded by status (kept only so historical rows are not destructively altered). Do not read/write from application code.';
comment on column public.blog_posts.status is
  'Editorial lifecycle: draft (author editing, not yet submitted) | submitted (awaiting moderation) | changes_requested (admin sent back with review_message) | scheduled (approved, publishes at scheduled_for) | published | archived (soft-deleted).';
comment on column public.blog_posts.published_at is
  'When the post actually went live. Backfilled from created_at for pre-existing published rows.';
comment on column public.blog_posts.scheduled_for is
  'When a scheduled post should auto-publish. Null unless status = scheduled.';
comment on column public.blog_posts.reviewed_at is
  'When an admin last reviewed (approved / requested changes on) this post.';
comment on column public.blog_posts.reviewed_by is
  'Admin who last reviewed this post.';
comment on column public.blog_posts.review_message is
  'Admin feedback shown to the author, set when status = changes_requested.';

create table if not exists public.blog_post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  title text not null,
  blocks jsonb not null,
  blocks_schema_version integer not null,
  category text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create index if not exists blog_post_revisions_post_id_idx on public.blog_post_revisions (post_id, created_at desc);

alter table public.blog_post_revisions enable row level security;

-- Only the backend (service role, bypasses RLS entirely) reads/writes this table today —
-- no author-facing revision-history UI exists yet. Admin SELECT policy mirrors the
-- moderation_logs precedent so the table isn't silently unreadable if that UI is ever
-- built directly against Supabase instead of through the backend.
create policy "Admins can view post revisions"
  on public.blog_post_revisions for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "System can insert post revisions"
  on public.blog_post_revisions for insert
  with check (true);

comment on table public.blog_post_revisions is
  'Insert-only snapshot of a blog post''s content, one row per save/submit/publish. Restoring a revision creates a new edit (and a new revision row); history here is never mutated or deleted.';
