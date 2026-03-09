-- Add suspension tracking - using a separate table to avoid modifying unique constraint issues
CREATE TABLE IF NOT EXISTS public.admin_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_suspended boolean NOT NULL DEFAULT false,
  suspended_at timestamptz,
  suspended_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin status"
ON public.admin_status FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can manage admin status"
ON public.admin_status FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));