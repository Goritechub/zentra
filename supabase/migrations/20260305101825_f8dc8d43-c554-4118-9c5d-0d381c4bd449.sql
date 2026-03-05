-- Add images array to service_offers
ALTER TABLE public.service_offers ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}'::text[];

-- Create service-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('service-images', 'service-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for service-images bucket
CREATE POLICY "Anyone can view service images" ON storage.objects FOR SELECT USING (bucket_id = 'service-images');
CREATE POLICY "Authenticated users can upload service images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'service-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete own service images" ON storage.objects FOR DELETE USING (bucket_id = 'service-images' AND auth.uid() IS NOT NULL);