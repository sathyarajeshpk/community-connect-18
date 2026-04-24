-- Add payment proof link for resident-uploaded screenshots
ALTER TABLE public.maintenance_payments
  ADD COLUMN IF NOT EXISTS proof_url text;

-- Public bucket for payment proof screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Residents can upload only to their own folder
CREATE POLICY "payment proofs upload own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "payment proofs read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs');

CREATE POLICY "payment proofs update own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "payment proofs delete own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
