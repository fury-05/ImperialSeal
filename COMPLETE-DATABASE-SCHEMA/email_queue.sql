
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuance_id UUID REFERENCES issuances(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id),

  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(500),
  html_body TEXT,
  attachments JSONB DEFAULT '[]',      -- [{filename, url}]

  status VARCHAR(20) DEFAULT 'queued', -- queued, sent, failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);