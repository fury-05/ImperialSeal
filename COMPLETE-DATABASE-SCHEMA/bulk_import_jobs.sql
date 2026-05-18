CREATE TABLE bulk_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES institution_users(id),

  filename VARCHAR(255),
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, validating, processing, completed, failed
  error_log JSONB DEFAULT '[]',
  csv_url TEXT,                        -- stored raw CSV in Oracle

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);