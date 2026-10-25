-- Upgrade existing projects (CREATE TABLE IF NOT EXISTS does not add columns).
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS recording_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS recording_consent_at TIMESTAMPTZ;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS recording_duration INTEGER;
ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_sales_status_check;
ALTER TABLE public.calls ADD CONSTRAINT calls_sales_status_check CHECK (sales_status IN (
  'Converted', 'Interested', 'Follow-up Required', 'Not Interested', 'Demo Requested', 'No Response', 'Unclassified'
));
-- Unclassified is an analysis failure marker, not a sales outcome.
DROP POLICY IF EXISTS "Allow recording removal" ON storage.objects;
CREATE POLICY "Allow recording removal" ON storage.objects FOR DELETE USING (bucket_id = 'call-recordings');
