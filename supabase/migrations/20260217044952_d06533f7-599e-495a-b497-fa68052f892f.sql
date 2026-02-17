
-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to chat-attachments
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

-- Allow anyone to view chat attachments
CREATE POLICY "Chat attachments are viewable by authenticated users"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
