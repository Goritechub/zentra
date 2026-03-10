
-- FIX 1: Prevent signup role privilege escalation
-- Always set role to 'client' on signup, never trust client metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'client',
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FIX 2: Move auth_code_hash to a separate table with strict RLS
-- Create the new table
CREATE TABLE IF NOT EXISTS public.auth_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_codes ENABLE ROW LEVEL SECURITY;

-- Users can only read their own auth code (needed for "check" action via edge function)
CREATE POLICY "Users can view own auth code"
  ON public.auth_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE from client - all managed by edge function with service role

-- Migrate existing auth_code_hash data from profiles to auth_codes
INSERT INTO public.auth_codes (user_id, auth_code_hash)
SELECT id, auth_code_hash
FROM public.profiles
WHERE auth_code_hash IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Remove auth_code_hash column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS auth_code_hash;
