CREATE TABLE certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,

  -- Template design JSON (full layout spec)
  design_json JSONB NOT NULL DEFAULT '{}',
  preview_image_url TEXT,
  pdf_template_url TEXT,

  -- Dynamic fields config
  fields JSONB DEFAULT '[]',
  /*
  fields example:
  [
    {"key": "recipient_name", "label": "Recipient Name", "type": "text", "required": true},
    {"key": "issue_date", "label": "Issue Date", "type": "date", "required": true},
    {"key": "grade", "label": "Grade/Score", "type": "text", "required": false}
  ]
  */

  -- Co-host logos (up to 4)
  cohost_1_name VARCHAR(255),
  cohost_1_logo_url TEXT,
  cohost_2_name VARCHAR(255),
  cohost_2_logo_url TEXT,
  cohost_3_name VARCHAR(255),
  cohost_3_logo_url TEXT,
  cohost_4_name VARCHAR(255),
  cohost_4_logo_url TEXT,

  -- Sponsor logos (up to 4)
  sponsor_1_name VARCHAR(255),
  sponsor_1_logo_url TEXT,
  sponsor_2_name VARCHAR(255),
  sponsor_2_logo_url TEXT,
  sponsor_3_name VARCHAR(255),
  sponsor_3_logo_url TEXT,
  sponsor_4_name VARCHAR(255),
  sponsor_4_logo_url TEXT,

  -- Compliance badges (paid add-ons — logo placements)
  compliance_badges JSONB DEFAULT '[]',
  /*
  [{"name": "CPD Certified", "logo_url": "...", "unlocked": true}]
  */

  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);