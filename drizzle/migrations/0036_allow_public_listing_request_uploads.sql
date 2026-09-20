-- السماح للزوار برفع صور طلبات العقار داخل مجلد public/ فقط
DROP POLICY IF EXISTS "public can upload listing request media" ON storage.objects;
CREATE POLICY "public can upload listing request media"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'listing-request-media'
  AND (storage.foldername(name))[1] = 'public'
);