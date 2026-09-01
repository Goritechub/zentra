-- Public "Get a Quote" lead-gen form: anonymous visitors submit a project
-- brief without creating an account or a public job post. All access goes
-- through the service-role backend (mirrors the `waitlist` table posture) --
-- no permissive RLS policies since there is no authenticated owner.

CREATE TABLE IF NOT EXISTS quote_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name      TEXT NOT NULL,
  contact_email     TEXT NOT NULL,
  contact_phone     TEXT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  budget_min        NUMERIC NULL,
  budget_max        NUMERIC NULL,
  delivery_days     INTEGER NULL,
  delivery_unit     TEXT NULL,
  category          TEXT NULL,
  skill_level       TEXT NULL,
  required_software TEXT[] NOT NULL DEFAULT '{}',
  is_remote         BOOLEAN NOT NULL DEFAULT true,
  attachments       TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'new', -- 'new' | 'in_review' | 'quoted' | 'closed'
  admin_notes       TEXT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_status     ON quote_requests (status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON quote_requests (created_at DESC);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
-- No policies: all reads/writes go through the service-role backend only.

-- Dedicated storage bucket for quote-request attachments. Separate from
-- 'job-attachments' since submitters are anonymous (no auth.uid() to scope
-- upload/delete policies by), so access control lives entirely in the backend.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quote-attachments',
  'quote-attachments',
  true,
  52428800, -- 50 MB per file (matches the NestJS FilesInterceptor limit)
  NULL
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view quote attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quote-attachments');
