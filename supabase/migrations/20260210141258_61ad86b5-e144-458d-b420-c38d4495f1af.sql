
-- Contests table
CREATE TABLE public.contests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  prize_first INTEGER NOT NULL DEFAULT 0,
  prize_second INTEGER DEFAULT 0,
  prize_third INTEGER DEFAULT 0,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  required_skills TEXT[] DEFAULT '{}'::TEXT[],
  required_software TEXT[] DEFAULT '{}'::TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contests viewable by everyone" ON public.contests FOR SELECT USING (true);
CREATE POLICY "Clients can create contests" ON public.contests FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update own contests" ON public.contests FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Clients can delete own contests" ON public.contests FOR DELETE USING (auth.uid() = client_id);

-- Contest entries
CREATE TABLE public.contest_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  freelancer_id UUID NOT NULL REFERENCES public.profiles(id),
  description TEXT,
  attachments TEXT[] DEFAULT '{}'::TEXT[],
  is_winner BOOLEAN DEFAULT false,
  prize_position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entries viewable by contest owner and entrant" ON public.contest_entries FOR SELECT
  USING (auth.uid() = freelancer_id OR EXISTS (SELECT 1 FROM public.contests WHERE contests.id = contest_entries.contest_id AND contests.client_id = auth.uid()));
CREATE POLICY "Freelancers can submit entries" ON public.contest_entries FOR INSERT WITH CHECK (auth.uid() = freelancer_id);
CREATE POLICY "Freelancers can update own entries" ON public.contest_entries FOR UPDATE USING (auth.uid() = freelancer_id);

-- Offers (client sends direct offers to freelancers)
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id),
  freelancer_id UUID NOT NULL REFERENCES public.profiles(id),
  job_id UUID REFERENCES public.jobs(id),
  title TEXT NOT NULL,
  description TEXT,
  budget INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offers viewable by participants" ON public.offers FOR SELECT USING (auth.uid() = client_id OR auth.uid() = freelancer_id);
CREATE POLICY "Clients can create offers" ON public.offers FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Participants can update offers" ON public.offers FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = freelancer_id);

-- Saved experts
CREATE TABLE public.saved_experts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id),
  freelancer_id UUID NOT NULL REFERENCES public.profiles(id),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(client_id, freelancer_id)
);

ALTER TABLE public.saved_experts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved experts" ON public.saved_experts FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Users can save experts" ON public.saved_experts FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Users can unsave experts" ON public.saved_experts FOR DELETE USING (auth.uid() = client_id);

-- Transactions / Wallet
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'escrow_hold', 'escrow_release', 'refund')),
  amount INTEGER NOT NULL,
  description TEXT,
  reference TEXT,
  contract_id UUID REFERENCES public.contracts(id),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Wallet balances
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  escrow_balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);

-- Service offers (freelancer-created service listings)
CREATE TABLE public.service_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  price INTEGER,
  delivery_days INTEGER,
  skills TEXT[] DEFAULT '{}'::TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.service_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service offers viewable by everyone" ON public.service_offers FOR SELECT USING (true);
CREATE POLICY "Freelancers can create service offers" ON public.service_offers FOR INSERT WITH CHECK (auth.uid() = freelancer_id);
CREATE POLICY "Freelancers can update own service offers" ON public.service_offers FOR UPDATE USING (auth.uid() = freelancer_id);
CREATE POLICY "Freelancers can delete own service offers" ON public.service_offers FOR DELETE USING (auth.uid() = freelancer_id);

-- Add triggers for updated_at
CREATE TRIGGER update_contests_updated_at BEFORE UPDATE ON public.contests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_service_offers_updated_at BEFORE UPDATE ON public.service_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
