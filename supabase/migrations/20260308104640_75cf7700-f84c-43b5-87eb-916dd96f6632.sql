
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update platform settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert platform settings"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed commission tiers
INSERT INTO public.platform_settings (key, value) VALUES (
  'commission_tiers',
  '[{"max_amount": 300000, "rate": 20, "label": "Up to ₦300,000"}, {"max_amount": 2000000, "rate": 15, "label": "₦300,001 – ₦2,000,000"}, {"max_amount": 10000000, "rate": 10, "label": "₦2,000,001 – ₦10,000,000"}, {"max_amount": null, "rate": 7, "label": "Above ₦10,000,000"}]'::jsonb
);
