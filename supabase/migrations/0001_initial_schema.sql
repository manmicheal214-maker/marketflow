-- ═══════════════════════════════════════════════════════════════
-- MarketFlow — Supabase PostgreSQL Migration
-- Email Marketing Automation & CRM Platform
-- ═══════════════════════════════════════════════════════════════

-- ── Profiles (extends Supabase auth.users) ──
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_color TEXT DEFAULT '#2563eb',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Contacts ──
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Lead' CHECK (status IN ('Lead','Interested','Customer','Inactive','Unsubscribed')),
  source TEXT NOT NULL DEFAULT 'Manual',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_email_unique ON contacts(user_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(user_id, created_at);

-- ── Segments ──
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  combinator TEXT NOT NULL DEFAULT 'and' CHECK (combinator IN ('and','or')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_segments_user_id ON segments(user_id);

-- ── Campaigns ──
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Scheduled','Sending','Sent','Cancelled')),
  segment_id UUID REFERENCES segments(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  budget DECIMAL(10,2),
  revenue DECIMAL(10,2),
  conversions INTEGER,
  sent INTEGER NOT NULL DEFAULT 0,
  opens INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  unsubscribes INTEGER NOT NULL DEFAULT 0,
  bounces INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(user_id, created_at);

-- ── Email Templates ──
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Custom',
  subject TEXT NOT NULL,
  preview_text TEXT,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON email_templates(user_id);

-- ── Email Events ──
CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('email_sent','email_delivered','email_opened','email_clicked','email_bounced','email_unsubscribed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON email_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_campaign_id ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_contact_id ON email_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON email_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON email_events(user_id, created_at);

-- ── Automations ──
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','draft')),
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automations_user_id ON automations(user_id);

-- ── Automation Steps (normalized form) ──
CREATE TABLE IF NOT EXISTS automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  label TEXT,
  next_step_id UUID REFERENCES automation_steps(id)
);

-- ── Automation Enrollments ──
CREATE TABLE IF NOT EXISTS automation_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES automation_steps(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','exited')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_enrollments_automation ON automation_enrollments(automation_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON automation_enrollments(contact_id);

-- ── A/B Tests ──
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  winning_metric TEXT NOT NULL DEFAULT 'open_rate' CHECK (winning_metric IN ('open_rate','click_rate')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','completed')),
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ab_tests_user_id ON ab_tests(user_id);

-- ── A/B Test Variants (normalized form) ──
CREATE TABLE IF NOT EXISTS ab_test_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  opens INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  unsubscribes INTEGER NOT NULL DEFAULT 0,
  is_winner BOOLEAN NOT NULL DEFAULT false
);

-- ── Lead Score Events ──
CREATE TABLE IF NOT EXISTS lead_score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_score_events_user_id ON lead_score_events(user_id);
CREATE INDEX IF NOT EXISTS idx_score_events_contact_id ON lead_score_events(contact_id);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- Every user can only access their own data.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score_events ENABLE ROW LEVEL SECURITY;

-- ── Profiles policies ──
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── Helper: apply standard CRUD policies to user-owned tables ──
-- Pattern: user_id = auth.uid()

-- Contacts
CREATE POLICY "Users can view own contacts" ON contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contacts" ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON contacts FOR DELETE USING (auth.uid() = user_id);

-- Segments
CREATE POLICY "Users can view own segments" ON segments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own segments" ON segments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own segments" ON segments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own segments" ON segments FOR DELETE USING (auth.uid() = user_id);

-- Campaigns
CREATE POLICY "Users can view own campaigns" ON campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaigns" ON campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON campaigns FOR DELETE USING (auth.uid() = user_id);

-- Email Templates
CREATE POLICY "Users can view own templates" ON email_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON email_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON email_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON email_templates FOR DELETE USING (auth.uid() = user_id);

-- Email Events
CREATE POLICY "Users can view own events" ON email_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON email_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON email_events FOR DELETE USING (auth.uid() = user_id);

-- Automations
CREATE POLICY "Users can view own automations" ON automations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own automations" ON automations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own automations" ON automations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own automations" ON automations FOR DELETE USING (auth.uid() = user_id);

-- Automation Steps (via automation ownership)
CREATE POLICY "Users can view own automation steps" ON automation_steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM automations WHERE automations.id = automation_steps.automation_id AND automations.user_id = auth.uid())
);
CREATE POLICY "Users can insert own automation steps" ON automation_steps FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM automations WHERE automations.id = automation_steps.automation_id AND automations.user_id = auth.uid())
);

-- Automation Enrollments (via automation ownership)
CREATE POLICY "Users can view own enrollments" ON automation_enrollments FOR SELECT USING (
  EXISTS (SELECT 1 FROM automations WHERE automations.id = automation_enrollments.automation_id AND automations.user_id = auth.uid())
);

-- A/B Tests
CREATE POLICY "Users can view own ab_tests" ON ab_tests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ab_tests" ON ab_tests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ab_tests" ON ab_tests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ab_tests" ON ab_tests FOR DELETE USING (auth.uid() = user_id);

-- A/B Test Variants (via ab_test ownership)
CREATE POLICY "Users can view own ab_test_variants" ON ab_test_variants FOR SELECT USING (
  EXISTS (SELECT 1 FROM ab_tests WHERE ab_tests.id = ab_test_variants.ab_test_id AND ab_tests.user_id = auth.uid())
);

-- Lead Score Events
CREATE POLICY "Users can view own score_events" ON lead_score_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own score_events" ON lead_score_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own score_events" ON lead_score_events FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Auto-create profile on user signup
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_color)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), '#2563eb');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
