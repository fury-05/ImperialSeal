CREATE TABLE email_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,           -- sendgrid, mailgun, smtp, resend, brevo
  is_active BOOLEAN DEFAULT false,
  api_key TEXT,                        -- encrypted at app layer
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_user VARCHAR(255),
  smtp_pass TEXT,                      -- encrypted at app layer
  from_name VARCHAR(100),
  from_email VARCHAR(255),
  daily_limit INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);