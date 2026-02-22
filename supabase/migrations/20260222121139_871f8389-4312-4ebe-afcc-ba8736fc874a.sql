
-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN username text;

-- Add unique constraint
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Create index for fast lookups
CREATE INDEX idx_profiles_username ON public.profiles (username);

-- Update the handle_new_user trigger to include username
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client'),
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$function$;
