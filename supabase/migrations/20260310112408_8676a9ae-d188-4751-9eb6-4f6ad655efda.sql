
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS occupation text DEFAULT NULL;
ALTER TABLE public.freelancer_profiles DROP COLUMN IF EXISTS primary_category;
