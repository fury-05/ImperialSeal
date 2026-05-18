CREATE TABLE cohost_sponsor_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL,   -- cohost, sponsor
  slot_number INTEGER,                 -- 1-4
  entity_name VARCHAR(255),            -- name of the co-host or sponsor
  message TEXT,                        -- institution's message to super admin
  status VARCHAR(20) DEFAULT 'pending', -- pending, priced, paid, approved, rejected
  fee_usd DECIMAL(10,2),               -- set by super admin
  payment_tx_id TEXT,                  -- on-chain tx hash
  payment_confirmed BOOLEAN DEFAULT false,
  super_admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);