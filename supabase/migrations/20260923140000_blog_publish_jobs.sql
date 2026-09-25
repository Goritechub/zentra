-- Durable queue for the "post published" email notification, replacing the fire-and-forget
-- fanOut(...).catch(() => {}) call in blog.service.ts's publishPost(). Swept by BlogService's
-- @Cron sweepBlogPublishJobs using the same optimistic-lock claim pattern as
-- scheduler.service.ts (claim by asserting pre-claim status/attempts in the WHERE clause).

create table if not exists public.blog_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.blog_publish_jobs
  drop constraint if exists blog_publish_jobs_status_check;
alter table public.blog_publish_jobs
  add constraint blog_publish_jobs_status_check
  check (status in ('pending', 'sent', 'failed'));

create index if not exists blog_publish_jobs_pending_idx
  on public.blog_publish_jobs (created_at)
  where status = 'pending';

alter table public.blog_publish_jobs enable row level security;

-- Purely a backend-internal operational queue — only the service role (bypasses RLS
-- entirely) reads/writes it, via BlogService's publishPost/sweepBlogPublishJobs. Admin
-- SELECT policy mirrors the moderation_logs/blog_post_revisions precedent for defense
-- in depth, in case an admin-facing "failed notifications" view is ever built directly
-- against Supabase.
create policy "Admins can view publish jobs"
  on public.blog_publish_jobs for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "System can insert publish jobs"
  on public.blog_publish_jobs for insert
  with check (true);

comment on table public.blog_publish_jobs is
  'Queue of "post published" email notifications to send via EmailService.fanOut. One row per publishPost() call; swept every 5 minutes and retried up to 3 attempts before being marked failed.';
comment on column public.blog_publish_jobs.status is
  'pending (not yet sent, or a retryable failure) | sent | failed (exhausted MAX_PUBLISH_JOB_ATTEMPTS).';
comment on column public.blog_publish_jobs.attempts is
  'Incremented on every claim, including the one currently in flight — used both to cap retries and as the optimistic-lock version for claiming.';
