ALTER TABLE public.profiles 
ADD COLUMN full_name_edited boolean NOT NULL DEFAULT false,
ADD COLUMN username_edited boolean NOT NULL DEFAULT false;