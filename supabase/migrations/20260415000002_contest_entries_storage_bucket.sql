-- Create a dedicated storage bucket for contest entry attachments.
-- Previously entry files were uploaded to 'contest-banners', which was
-- designed for images only. This bucket is separate, public, and accepts
-- any file type (PDF, images, DWG, DXF, ZIP, and other CAD formats).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contest-entries',
  'contest-entries',
  true,
  20971520,  -- 20 MB per file (matches the NestJS FilesInterceptor limit)
  NULL       -- NULL = all MIME types allowed; validation is enforced in the backend service
)
ON CONFLICT (id) DO NOTHING;

-- Public read access — entry attachments are visible to all contest viewers
CREATE POLICY "Anyone can view contest entry attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contest-entries');

-- Authenticated users can upload — the backend further restricts this to
-- verified freelancers via the service role + business logic checks
CREATE POLICY "Authenticated users can upload contest entry attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contest-entries'
    AND auth.uid() IS NOT NULL
  );

-- Users can delete only their own uploaded files
CREATE POLICY "Users can delete their own contest entry attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contest-entries'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'entry-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
