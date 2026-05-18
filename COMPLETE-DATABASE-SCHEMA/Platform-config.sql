-- Global platform settings — brand name lives here for instant rename
CREATE TABLE platform_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data
INSERT INTO platform_config (key, value) VALUES
  ('brand_name', 'ImperialSeal'),
  ('brand_tagline', 'Blockchain-Verified Credentials for the Modern Institution'),
  ('brand_logo_url', ''),
  ('brand_favicon_url', ''),
  ('support_email', 'support@imperialseal.io'),
  ('primary_color', '#0A0F1E'),
  ('accent_color', '#C9A84C'),
  ('super_admin_algorand_wallet', ''),
  ('super_admin_voi_wallet', ''),
  ('default_email_provider', 'sendgrid'),
  ('email_daily_limit', '100'),
  ('design_unlock_base_price_usd', '150'),
  ('maintenance_mode', 'false');