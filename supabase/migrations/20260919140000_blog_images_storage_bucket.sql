-- Storage bucket for blog post images, uploaded via the backend-validated
-- POST /blog/posts/upload-images endpoint (mirrors marketplace.service.ts's
-- uploadImages() pattern: server-side Multer upload, extension allow-list).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  true,
  10485760,  -- 10 MB per file (matches the NestJS FilesInterceptor limit)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access — post images are visible to all blog readers
CREATE POLICY "Anyone can view blog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

-- Authenticated users can upload — the backend further restricts this to the
-- caller's own folder via the service role + business logic checks
CREATE POLICY "Authenticated users can upload blog images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'blog-images'
    AND auth.uid() IS NOT NULL
  );

-- Users can delete only their own uploaded images
CREATE POLICY "Users can delete their own blog images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'blog-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'posts'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
