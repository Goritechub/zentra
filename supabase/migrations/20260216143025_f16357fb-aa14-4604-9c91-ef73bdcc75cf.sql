
-- Add skill levels JSONB column to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS required_skill_levels jsonb DEFAULT '{}';

-- Create storage bucket for job attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('job-attachments', 'job-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for proposal attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('proposal-attachments', 'proposal-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for job-attachments bucket
CREATE POLICY "Authenticated users can upload job attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'job-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view job attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-attachments');

CREATE POLICY "Users can delete their own job attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'job-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policies for proposal-attachments bucket
CREATE POLICY "Authenticated users can upload proposal attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'proposal-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view proposal attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'proposal-attachments');

CREATE POLICY "Users can delete their own proposal attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'proposal-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
