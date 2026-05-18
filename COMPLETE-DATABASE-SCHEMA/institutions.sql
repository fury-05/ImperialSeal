CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,   -- url-safe identifier
  type VARCHAR(50),                    -- university, college, academy, bootcamp, other
  logo_url TEXT,
  website VARCHAR(255),
  address TEXT,
  country VARCHAR(100),
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),

  -- Subscription
  subscription_status VARCHAR(20) DEFAULT 'pending', -- pending, active, suspended, expired
  subscription_start TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  annual_fee_usd DECIMAL(10,2),
  payment_token VARCHAR(20),           -- usdc_algorand, algo, walgo, voi
  payment_wallet_address TEXT,         -- institution's payment wallet (where they pay from)
  super_admin_receiving_wallet TEXT,   -- YOUR wallet address for this client's payments

  -- Custodial blockchain wallet (for issuance fees)
  custodial_voi_wallet_address TEXT,
  custodial_voi_wallet_key_encrypted TEXT,
  custodial_algo_wallet_address TEXT,
  custodial_algo_wallet_key_encrypted TEXT,

  -- Limits & flags
  max_courses INTEGER DEFAULT 999,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,                          -- super admin internal notes

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);