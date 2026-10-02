-- Every SECURITY DEFINER function in `public` currently has EXECUTE granted to
-- anon and authenticated (Postgres's default function privilege, never revoked
-- for these). Since every write to financial/account tables goes through
-- these functions specifically because RLS blocks direct table writes, that
-- default makes the RPC grant the *only* authorization boundary for money and
-- account-deletion mutations -- and right now it doesn't exist. Any caller
-- (anon needs no token at all) can hit these via PostgREST
-- (`/rest/v1/rpc/<name>`) directly, bypassing every NestJS/Deno-layer check.
--
-- This locks down the functions that mutate money, wallets, escrow, or
-- accounts -- or that are read-only but return another user's private data
-- (get_funding_status) -- to service_role only. The backend and Edge
-- Functions already call these exclusively with the service-role client, so
-- this is a no-op for legitimate traffic (confirmed by grepping every
-- `.rpc("<name>", ...)` call site in zentra/src, zentra-backend/src and
-- zentra/supabase/functions before writing this migration).
--
-- Every REVOKE below names PUBLIC, anon, and authenticated explicitly, not
-- just PUBLIC. `has_function_privilege`-style audits (including the one that
-- produced functions.md) show *effective* access, not which ACL entry grants
-- it -- REVOKE ... FROM PUBLIC only strips the implicit default-privilege
-- grant every role inherits through PUBLIC; if anon/authenticated also ever
-- received a direct GRANT EXECUTE at some point (independent of that
-- default), it survives a PUBLIC-only revoke untouched. Naming the roles
-- directly removes both, whichever is actually in effect, and revoking a
-- grant that was never direct is a harmless no-op. (No `ALTER DEFAULT
-- PRIVILEGES` for functions exists anywhere in this migration history, so
-- this is purely about the ACLs these specific functions already have, not
-- about what future CREATE FUNCTIONs will inherit.)
--
-- Excluded, deliberately:
--  * delete_user_account -- called directly from the frontend with the
--    user's own session (MyProfile.tsx, Settings.tsx), so `authenticated`
--    must stay granted. It already checks `auth.uid() = _user_id` internally,
--    so only the unauthenticated `anon` grant is dead weight to remove here.
--  * has_role / is_super_admin -- used ~95 times across migrations inside RLS
--    `USING`/`WITH CHECK` clauses (confirmed by grep). Revoking EXECUTE from
--    authenticated/anon would break RLS evaluation for every policy that
--    calls them, i.e. most of the schema.
--  * get_contest_entry_count, get_blog_tag_facets -- read-only aggregates
--    over already-public data (published posts, contest entry counts shown
--    on public contest pages); no private data exposed.
--  * get_auth_bootstrap_state, count_unread_contract_messages -- already
--    self-check `auth.uid()` internally and are explicitly granted to
--    `authenticated` in their own migration; only the PUBLIC/anon grant is
--    removed here.
--  * All RETURNS trigger functions -- Postgres refuses to invoke a trigger
--    function outside trigger context regardless of EXECUTE grants, so
--    they're not reachable via PostgREST either way.
--
-- Note: admin_close_user_account itself never checks that the caller
-- (auth.uid()) is the _admin_id it was passed -- it only checks that
-- _admin_id IS a super admin. That's a separate, function-body-level bug
-- (anyone who could call it with an arbitrary _admin_id could impersonate
-- that admin) which this migration does not fix, but it's neutralized as an
-- external attack surface once EXECUTE is restricted to service_role, since
-- the NestJS caller (admin-read.service.ts) already derives _admin_id from
-- the verified bearer token, not from caller input.
--
-- After applying, re-run the functions.md-style privilege audit and confirm
-- `can_execute` is exactly `service_role` for every function below (and
-- exactly `authenticated, service_role` for the three kept-authenticated
-- ones), with no residual anon/authenticated entry.

REVOKE ALL ON FUNCTION public.credit_wallet_atomic(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet_atomic(uuid, integer, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.withdraw_wallet_atomic(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_wallet_atomic(uuid, integer, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reverse_withdrawal_atomic(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_withdrawal_atomic(uuid, uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_close_user_account(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_close_user_account(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fund_milestone_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fund_milestone_atomic(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.release_milestone_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_milestone_atomic(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.resolve_dispute_atomic(uuid, uuid, uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dispute_atomic(uuid, uuid, uuid, text, text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.publish_contest_winners_atomic(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_contest_winners_atomic(uuid, uuid, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.publish_contest_winners_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_contest_winners_atomic(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.launch_contest_atomic(
  uuid, text, text, text, integer, integer, integer, integer, integer,
  timestamp with time zone, text[], text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.launch_contest_atomic(
  uuid, text, text, text, integer, integer, integer, integer, integer,
  timestamp with time zone, text[], text, text, text, text
) TO service_role;

REVOKE ALL ON FUNCTION public.launch_contest_atomic(
  uuid, text, text, text, integer, integer, integer, integer, integer,
  timestamp with time zone, text[], text, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.launch_contest_atomic(
  uuid, text, text, text, integer, integer, integer, integer, integer,
  timestamp with time zone, text[], text, text, text, text, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.clear_pending_funds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_pending_funds() TO service_role;

REVOKE ALL ON FUNCTION public.get_funding_status(uuid, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_funding_status(uuid, integer, integer, uuid) TO service_role;

-- debit_wallet_for_stripe_payout_atomic: granted in its own creation
-- migration (20261002090100), not here -- a cross-migration-file gap between
-- that file's commit and this one's would otherwise leave it at the default
-- PUBLIC/anon/authenticated grant while the API is live in between.

-- delete_user_account: keep `authenticated` (frontend calls it directly with
-- the user's own session), drop only the PUBLIC/anon grant.
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated, service_role;

-- Self-checking helpers: already verify auth.uid() internally and are
-- already explicitly granted to `authenticated`; just drop the PUBLIC/anon
-- grant.
REVOKE ALL ON FUNCTION public.get_auth_bootstrap_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_bootstrap_state(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.count_unread_contract_messages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_unread_contract_messages(uuid) TO authenticated, service_role;
