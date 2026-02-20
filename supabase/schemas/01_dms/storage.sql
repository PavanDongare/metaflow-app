-- DMS Storage
-- Documents bucket and policies

-- Create documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'documents');

-- Allow uploads
CREATE POLICY "Allow uploads" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'documents');

-- Allow deletes
CREATE POLICY "Allow deletes" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'documents');
