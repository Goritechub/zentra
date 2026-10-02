-- Emergency fix: the post-apply privilege audit (RESULTS.TXT) showed these 4
-- functions still executable by anon/authenticated with no auth check in
-- their bodies -- live, callable with no token at all. The 090200 migration
-- only wrote `REVOKE ALL FROM PUBLIC` for these, on the assumption that a
-- brand-new function has nothing to revoke beyond the PUBLIC default. That
-- assumption is wrong for this project: the audit proves anon/authenticated
-- get EXECUTE directly at function-creation time, independent of PUBLIC
-- (most likely Supabase's own platform-level ALTER DEFAULT PRIVILEGES
-- bootstrap for the public schema, which lives outside this repo's migration
-- history). Every REVOKE in this project must name anon/authenticated
-- explicitly, not just PUBLIC -- confirmed by this exact gap.

REVOKE ALL ON FUNCTION public.reserve_platform_revenue_withdrawal_atomic(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_platform_revenue_withdrawal_atomic(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_platform_revenue_withdrawal_atomic(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flag_platform_revenue_withdrawal_ambiguous_atomic(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_platform_revenue_withdrawal_atomic(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_platform_revenue_withdrawal_atomic(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_platform_revenue_withdrawal_atomic(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.flag_platform_revenue_withdrawal_ambiguous_atomic(uuid, uuid, text, text) TO service_role;
