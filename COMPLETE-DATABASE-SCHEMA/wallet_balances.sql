CREATE TABLE wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  blockchain VARCHAR(20) NOT NULL,     -- voi, algorand
  wallet_address TEXT NOT NULL,
  balance_native DECIMAL(20,8) DEFAULT 0,
  balance_usd_equivalent DECIMAL(10,4) DEFAULT 0,
  last_synced TIMESTAMPTZ DEFAULT now(),
  UNIQUE(institution_id, blockchain)
);