
-- 1) Trigger to auto-update job status when contract is completed
CREATE OR REPLACE FUNCTION public.sync_job_status_on_contract_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND NEW.job_id IS NOT NULL THEN
    UPDATE public.jobs SET status = 'completed' WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_job_status_on_contract_complete
AFTER UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.sync_job_status_on_contract_complete();

-- 2) Add contest fields: visibility, banner_image, rules, winner_selection_method
ALTER TABLE public.contests 
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS banner_image text,
  ADD COLUMN IF NOT EXISTS rules text,
  ADD COLUMN IF NOT EXISTS winner_selection_method text DEFAULT 'client_selects';

-- 3) Create storage bucket for contest banners and service banners
INSERT INTO storage.buckets (id, name, public) VALUES ('contest-banners', 'contest-banners', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('service-banners', 'service-banners', true) ON CONFLICT DO NOTHING;

-- Storage policies for contest-banners
CREATE POLICY "Anyone can view contest banners" ON storage.objects FOR SELECT USING (bucket_id = 'contest-banners');
CREATE POLICY "Authenticated users can upload contest banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'contest-banners' AND auth.uid() IS NOT NULL);

-- Storage policies for service-banners
CREATE POLICY "Anyone can view service banners" ON storage.objects FOR SELECT USING (bucket_id = 'service-banners');
CREATE POLICY "Authenticated users can upload service banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'service-banners' AND auth.uid() IS NOT NULL);

-- 4) Enhance service_offers with more fields
ALTER TABLE public.service_offers 
  ADD COLUMN IF NOT EXISTS pricing_type text DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS delivery_unit text DEFAULT 'days',
  ADD COLUMN IF NOT EXISTS revisions_allowed integer,
  ADD COLUMN IF NOT EXISTS banner_image text;
