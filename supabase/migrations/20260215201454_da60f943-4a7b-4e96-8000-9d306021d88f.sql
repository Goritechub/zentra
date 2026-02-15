
-- Fix overly permissive INSERT policies by scoping to service role patterns
-- These tables are only written to by edge functions using service_role key,
-- so we restrict client-side inserts while keeping service role access.

-- moderation_logs: only service role should insert (edge functions)
DROP POLICY IF EXISTS "System can insert moderation logs" ON public.moderation_logs;
CREATE POLICY "Service role inserts moderation logs"
  ON public.moderation_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- user_violation_counts: only service role should manage
DROP POLICY IF EXISTS "System can upsert violation counts" ON public.user_violation_counts;
CREATE POLICY "Authenticated users can view own violations"
  ON public.user_violation_counts FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages violation counts"
  ON public.user_violation_counts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role updates violation counts"
  ON public.user_violation_counts FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- wallet_transactions: users can only view, service inserts
DROP POLICY IF EXISTS "System can insert wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Authenticated inserts wallet transactions"
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- platform_revenue: only service/admin
DROP POLICY IF EXISTS "System can insert platform revenue" ON public.platform_revenue;
CREATE POLICY "Admin inserts platform revenue"
  ON public.platform_revenue FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
