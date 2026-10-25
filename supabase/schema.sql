-- ==============================================================================
-- SalesPilot AI - Supabase Database Schema
-- Run this script in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Create calls table
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT DEFAULT 'Prospect',
    company_name TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    sales_status TEXT NOT NULL CHECK (sales_status IN (
        'Converted',
        'Interested',
        'Follow-up Required',
        'Not Interested',
        'Demo Requested',
        'No Response',
        'Unclassified'
    )),
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
    recording_url TEXT,
    recording_consent BOOLEAN NOT NULL DEFAULT FALSE,
    recording_consent_at TIMESTAMPTZ,
    recording_duration INTEGER,
    product_name TEXT DEFAULT 'FlowCRM',
    agent_name TEXT DEFAULT 'Alex',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- 3. Create permissive policies for demonstration / public anon access
-- Note: In production enterprise environments, restrict by user_id or auth.uid()
DROP POLICY IF EXISTS "Allow anonymous read access to calls" ON public.calls;
CREATE POLICY "Allow anonymous read access to calls"
    ON public.calls FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert access to calls" ON public.calls;
CREATE POLICY "Allow anonymous insert access to calls"
    ON public.calls FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous update access to calls" ON public.calls;
CREATE POLICY "Allow anonymous update access to calls"
    ON public.calls FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Allow anonymous delete access to calls" ON public.calls;
CREATE POLICY "Allow anonymous delete access to calls"
    ON public.calls FOR DELETE
    USING (true);

-- 4. Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON public.calls (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_sales_status ON public.calls (sales_status);

-- ==============================================================================
-- Supabase Storage Bucket Setup
-- 1. In Supabase Dashboard -> Storage -> Click "New Bucket"
-- 2. Name: "call-recordings"
-- 3. Toggle "Public bucket" to ON (or run the policy below)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for call-recordings
DROP POLICY IF EXISTS "Public Access call-recordings" ON storage.objects;
CREATE POLICY "Public Access call-recordings"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'call-recordings');

DROP POLICY IF EXISTS "Public Upload call-recordings" ON storage.objects;
CREATE POLICY "Public Upload call-recordings"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'call-recordings');

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
