-- blog_posts.likes_count was selected by blog.service.ts (POST_SUMMARY_COLUMNS /
-- POST_DETAIL_COLUMNS) and relied on by the frontend (blog.api.ts, Blog.tsx, BlogPost.tsx)
-- but was never actually created by any migration, causing every /blog/posts and
-- /blog/posts/:id request to 500. likePost/unlikePost only ever write to blog_post_likes,
-- so this is kept in sync via trigger rather than an app-level increment, mirroring the
-- existing recalculate_freelancer_rating()/protect_freelancer_stats() pattern of deriving a
-- denormalized counter from its source table.

alter table public.blog_posts
  add column if not exists likes_count integer not null default 0;

update public.blog_posts p
  set likes_count = coalesce((select count(*) from public.blog_post_likes l where l.post_id = p.id), 0);

create or replace function public.sync_blog_post_likes_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.blog_posts set likes_count = likes_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.blog_posts set likes_count = greatest(0, likes_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists blog_post_likes_sync_count on public.blog_post_likes;
create trigger blog_post_likes_sync_count
  after insert or delete on public.blog_post_likes
  for each row execute function public.sync_blog_post_likes_count();

comment on column public.blog_posts.likes_count is
  'Denormalized count of blog_post_likes rows for this post, kept in sync by the sync_blog_post_likes_count trigger. Read-only from the app — never written directly.';
