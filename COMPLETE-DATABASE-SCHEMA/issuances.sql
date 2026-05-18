CREATE TABLE issuances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  certificate_template_id UUID REFERENCES certificate_templates(id),
  badge_template_id UUID REFERENCES badge_templates(id),

  -- Recipient
  recipient_name VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_id VARCHAR(255),           -- student ID / roll number
  custom_fields JSONB DEFAULT '{}',    -- any extra template fields

  -- What was issued
  issue_certificate BOOLEAN DEFAULT false,
  issue_badge BOOLEAN DEFAULT false,

  -- Blockchain records
  blockchain VARCHAR(20),              -- voi, algorand
  certificate_asset_id BIGINT,         -- ARC-3 NFT asset ID on chain
  certificate_tx_id TEXT,              -- minting transaction hash
  badge_asset_id BIGINT,               -- ARC-69 NFT asset ID on chain
  badge_tx_id TEXT,                    -- minting transaction hash

  -- Files
  certificate_pdf_url TEXT,
  badge_image_url TEXT,
  verification_hash VARCHAR(64) UNIQUE, -- public verification identifier
  qr_code_url TEXT,

  -- Fees
  fee_usd DECIMAL(6,4),               -- actual USD equivalent charged
  fee_native DECIMAL(20,8),           -- VOI or ALGO amount charged
  fee_tx_id TEXT,                     -- fee payment tx hash

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, issued, failed
  failure_reason TEXT,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);