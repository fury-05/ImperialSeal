CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),                   -- internal course code
  description TEXT,
  field_of_study VARCHAR(255),
  course_type VARCHAR(50),             -- course, bootcamp, workshop, program, seminar

  -- What to issue
  issue_certificate BOOLEAN DEFAULT true,
  issue_badge BOOLEAN DEFAULT false,

  -- Blockchain config (LOCKED after creation)
  blockchain VARCHAR(20) NOT NULL,     -- voi, algorand
  blockchain_locked BOOLEAN DEFAULT true,

  -- Certificate type
  certificate_type VARCHAR(30),        -- participation, completion, excellence, custom
  certificate_orientation VARCHAR(10), -- portrait, landscape

  -- Co-host / sponsor slots
  cohost_slots_unlocked INTEGER DEFAULT 0,  -- 0-4
  sponsor_slots_unlocked INTEGER DEFAULT 0, -- 0-4

  -- Design state
  design_locked BOOLEAN DEFAULT false,
  design_locked_at TIMESTAMPTZ,
  design_hash VARCHAR(64),             -- SHA-256 of locked design JSON
  unlock_requested BOOLEAN DEFAULT false,
  unlock_requested_at TIMESTAMPTZ,
  unlock_approved BOOLEAN DEFAULT false,
  unlock_approved_at TIMESTAMPTZ,
  unlock_expires_at TIMESTAMPTZ,       -- 48hr window
  unlock_fee_usd DECIMAL(10,2),

  -- Status
  status VARCHAR(20) DEFAULT 'draft',  -- draft, active, archived
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);