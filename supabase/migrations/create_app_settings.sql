-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage settings" ON app_settings
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Everyone can read settings" ON app_settings
  FOR SELECT
  USING (true);

-- Insert default timezone setting if not exists
INSERT INTO app_settings (key, value, description)
VALUES ('timezone', '"America/Sao_Paulo"', 'Fuso horário padrão do sistema')
ON CONFLICT (key) DO NOTHING;
