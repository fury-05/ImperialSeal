CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  payment_type VARCHAR(50) NOT NULL,   -- annual_subscription, cohost_slot, sponsor_slot, design_unlock, issuance_fee
  reference_id UUID,                  -- points to relevant record (course_id, issuance_id, etc.)

  amount_usd DECIMAL(10,2),
  amount_native DECIMAL(20,8),
  token VARCHAR(20),                   -- usdc, algo, walgo, voi
  blockchain VARCHAR(20),              -- algorand, voi

  tx_hash TEXT UNIQUE,
  from_wallet TEXT,
  to_wallet TEXT,
  confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  block_number BIGINT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);