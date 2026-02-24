
-- Add rating category columns to reviews table
ALTER TABLE public.reviews ADD COLUMN rating_skills integer DEFAULT NULL;
ALTER TABLE public.reviews ADD COLUMN rating_quality integer DEFAULT NULL;
ALTER TABLE public.reviews ADD COLUMN rating_availability integer DEFAULT NULL;
ALTER TABLE public.reviews ADD COLUMN rating_deadlines integer DEFAULT NULL;
ALTER TABLE public.reviews ADD COLUMN rating_communication integer DEFAULT NULL;
ALTER TABLE public.reviews ADD COLUMN rating_cooperation integer DEFAULT NULL;
