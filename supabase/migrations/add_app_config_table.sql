-- Create app_config table to store application settings
CREATE TABLE IF NOT EXISTS app_config (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy to allow reading (public access)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON app_config
  FOR SELECT
  USING (true);

-- Insert initial version (change this when you need to update the app)
INSERT INTO app_config (key, value, description)
VALUES ('latest_version', '1.0.0', 'Latest available version of the application')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
