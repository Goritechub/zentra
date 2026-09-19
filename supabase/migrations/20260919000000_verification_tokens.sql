-- Generic, purpose-parameterized replacement for the one-off password_reset_tokens
-- table, so any "own-domain email link" flow (password reset, signup confirmation,
-- and future ones) shares one token mechanism instead of a duplicated table per flow.

create table if not exists public.verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists verification_tokens_token_hash_idx
  on public.verification_tokens (token_hash);

create index if not exists verification_tokens_user_purpose_idx
  on public.verification_tokens (user_id, purpose, used);

alter table public.verification_tokens enable row level security;
-- No policies: this table is only ever read/written by the backend's service-role
-- client, which bypasses RLS. Locked down for every other role by default.

-- password_reset_tokens is superseded by verification_tokens (purpose = 'password_reset').
-- Safe to drop: rows are single-use, short-lived (1h) tokens with no retained value.
drop table if exists public.password_reset_tokens;
