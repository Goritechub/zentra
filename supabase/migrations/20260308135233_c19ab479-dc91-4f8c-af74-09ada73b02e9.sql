
-- Create kyc_verifications table replacing verification_requests
CREATE TABLE public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  didit_session_id text,
  verification_url text,
  kyc_status text NOT NULL DEFAULT 'not_started',
  kyc_provider_status text,
  kyc_provider_result jsonb DEFAULT '{}'::jsonb,
  full_name_on_id text,
  date_of_birth date,
  country text,
  document_type text,
  verification_level text NOT NULL DEFAULT 'basic',
  zentra_verified boolean NOT NULL DEFAULT false,
  zentra_verified_at timestamptz,
  zentra_verified_by uuid,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification
CREATE POLICY "Users can view own kyc" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own verification
CREATE POLICY "Users can insert own kyc" ON public.kyc_verifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update own kyc (for setting session_id etc)
CREATE POLICY "Users can update own kyc" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all kyc" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all (for granting zentra verified)
CREATE POLICY "Admins can update all kyc" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated at trigger
CREATE TRIGGER update_kyc_verifications_updated_at
  BEFORE UPDATE ON public.kyc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
