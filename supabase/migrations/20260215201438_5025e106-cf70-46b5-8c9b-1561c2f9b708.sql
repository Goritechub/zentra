
-- =============================================
-- 1. USER ROLES TABLE (admin system)
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Only admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "Only admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 2. MODERATION LOGS
-- =============================================
CREATE TABLE public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('message', 'proposal', 'attachment')),
  raw_content TEXT,
  violation_reason TEXT NOT NULL,
  confidence NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation logs"
  ON public.moderation_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert moderation logs"
  ON public.moderation_logs FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 3. USER VIOLATION COUNTS
-- =============================================
CREATE TABLE public.user_violation_counts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_violations INTEGER NOT NULL DEFAULT 0,
  last_violation_at TIMESTAMPTZ,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  messaging_restricted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_violation_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view violation counts"
  ON public.user_violation_counts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "System can upsert violation counts"
  ON public.user_violation_counts FOR ALL
  WITH CHECK (true);

-- =============================================
-- 4. MILESTONES TABLE
-- =============================================
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'funded', 'in_progress', 'submitted', 'approved', 'disputed')),
  funded_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contract participants can view milestones"
  ON public.milestones FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = milestones.contract_id
    AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
  ));

CREATE POLICY "Clients can create milestones"
  ON public.milestones FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = milestones.contract_id AND c.client_id = auth.uid()
  ));

CREATE POLICY "Contract participants can update milestones"
  ON public.milestones FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = milestones.contract_id
    AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
  ));

-- Trigger for milestones updated_at
CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 5. DISPUTES TABLE
-- =============================================
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  milestone_id UUID REFERENCES public.milestones(id),
  raised_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved_client', 'resolved_freelancer', 'closed')),
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contract participants can view disputes"
  ON public.disputes FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = disputes.contract_id
      AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
    )
  );

CREATE POLICY "Contract participants can create disputes"
  ON public.disputes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = disputes.contract_id
    AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
  ));

CREATE POLICY "Admins can update disputes"
  ON public.disputes FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = disputes.contract_id
      AND (c.client_id = auth.uid() OR c.freelancer_id = auth.uid())
    )
  );

CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 6. WALLET TRANSACTIONS (detailed ledger)
-- =============================================
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'escrow_lock', 'escrow_release', 'commission', 'refund')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL DEFAULT 0,
  reference TEXT,
  description TEXT,
  contract_id UUID REFERENCES public.contracts(id),
  milestone_id UUID REFERENCES public.milestones(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert wallet transactions"
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 7. PLATFORM REVENUE TABLE
-- =============================================
CREATE TABLE public.platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id),
  milestone_id UUID REFERENCES public.milestones(id),
  gross_amount INTEGER NOT NULL,
  commission_rate NUMERIC NOT NULL,
  commission_amount INTEGER NOT NULL,
  net_to_freelancer INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view platform revenue"
  ON public.platform_revenue FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert platform revenue"
  ON public.platform_revenue FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 8. Add total_earned/total_spent to wallets
-- =============================================
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS total_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS total_spent INTEGER NOT NULL DEFAULT 0;

-- =============================================
-- 9. Add edit tracking to proposals
-- =============================================
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- =============================================
-- 10. Add skill_level to freelancer_profiles
-- =============================================
ALTER TABLE public.freelancer_profiles ADD COLUMN IF NOT EXISTS skill_levels JSONB DEFAULT '{}';

-- =============================================
-- 11. Enable realtime for key tables
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.milestones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.disputes;
