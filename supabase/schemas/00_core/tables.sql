-- Core Schema
-- Shared tables across all apps

-- ============================================================================
-- USER PROFILES (links auth.users to tenants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  default_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant access
GRANT ALL ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon;

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON public.user_profiles(default_tenant_id);

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, default_tenant_id)
  VALUES (NEW.id, '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
