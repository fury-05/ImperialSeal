CREATE TABLE badge_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  shape VARCHAR(20) DEFAULT 'circle',  -- circle, hexagon, square
  background_color VARCHAR(20),
  border_color VARCHAR(20),
  icon_url TEXT,
  badge_image_url TEXT,                -- final rendered badge image
  design_json JSONB DEFAULT '{}',

  -- Open Badges 2.0 metadata
  criteria_url TEXT,
  criteria_narrative TEXT,
  tags TEXT[],

  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);