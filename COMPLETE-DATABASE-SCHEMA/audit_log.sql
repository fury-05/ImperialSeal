CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(20),              -- super_admin, institution_user, system
  actor_id UUID,
  institution_id UUID,
  action VARCHAR(100) NOT NULL,        -- e.g. 'course.locked', 'issuance.created', 'brand.renamed'
  target_type VARCHAR(50),             -- course, issuance, institution, platform_config
  target_id UUID,
  metadata JSONB DEFAULT '{}',         -- before/after values, extra context
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);