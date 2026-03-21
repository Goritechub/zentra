CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS NULL AND NEW.role IN ('client', 'freelancer') THEN
    RETURN NEW;
  END IF;

  NEW.role := OLD.role;
  RETURN NEW;
END;
$$;
