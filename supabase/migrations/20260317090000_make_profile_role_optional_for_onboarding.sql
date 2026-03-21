ALTER TABLE public.profiles
ALTER COLUMN role DROP DEFAULT,
ALTER COLUMN role DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE
      WHEN NEW.raw_user_meta_data ? 'role'
        AND NEW.raw_user_meta_data->>'role' IN ('client', 'freelancer', 'admin')
      THEN (NEW.raw_user_meta_data->>'role')::public.user_role
      ELSE NULL
    END,
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
