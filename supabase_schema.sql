-- Supabase Schema for Nabda CRM

-- 1. Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  raw_phone TEXT,
  normalized_phone TEXT UNIQUE NOT NULL,
  whatsapp_phone TEXT,
  governorate TEXT,
  category TEXT,
  validity_status TEXT DEFAULT 'valid', -- 'valid', 'invalid'
  duplicate_status BOOLEAN DEFAULT FALSE,
  ready_to_send BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Templates Table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  normalized_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'replied'
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- 4. Send Logs Table
CREATE TABLE IF NOT EXISTS send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'nabda',
  status TEXT,
  response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_id UUID REFERENCES templates(id),
  filters JSONB, -- { category: '...', governorate: '...' }
  status TEXT DEFAULT 'draft', -- 'draft', 'active', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
-- For this "lightweight" app, we might want to keep it simple or add basic auth.
-- Here we enable RLS but allow all for simplicity as requested, 
-- but in production you'd lock this down.
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (Development/Lightweight)
CREATE POLICY "Allow all access" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON send_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON campaigns FOR ALL USING (true) WITH CHECK (true);
