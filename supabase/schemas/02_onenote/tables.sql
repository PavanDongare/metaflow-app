-- OneNote Schema
-- Notebooks, sections, and pages for note-taking

-- Create schema
CREATE SCHEMA IF NOT EXISTS onenote;

-- Grant access to Supabase roles
GRANT USAGE ON SCHEMA onenote TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA onenote TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA onenote GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ============================================================================
-- NOTEBOOKS (per-tenant with user audit)
-- ============================================================================
CREATE TABLE onenote.notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  user_id UUID,
  title TEXT NOT NULL DEFAULT 'Untitled Notebook',
  color TEXT DEFAULT '#3b82f6',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- SECTIONS (inherit tenant from notebook via FK)
-- ============================================================================
CREATE TABLE onenote.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID REFERENCES onenote.notebooks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Section',
  color TEXT DEFAULT '#8b5cf6',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- PAGES (inherit tenant from section → notebook via FK)
-- ============================================================================
CREATE TABLE onenote.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES onenote.sections(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Page',
  content TEXT DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_onenote_notebooks_tenant ON onenote.notebooks(tenant_id);
CREATE INDEX idx_onenote_notebooks_position ON onenote.notebooks(tenant_id, position);
CREATE INDEX idx_onenote_notebooks_deleted ON onenote.notebooks(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_onenote_sections_notebook ON onenote.sections(notebook_id);
CREATE INDEX idx_onenote_sections_position ON onenote.sections(position);
CREATE INDEX idx_onenote_sections_deleted ON onenote.sections(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_onenote_pages_section ON onenote.pages(section_id);
CREATE INDEX idx_onenote_pages_position ON onenote.pages(position);
CREATE INDEX idx_onenote_pages_deleted ON onenote.pages(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- TRIGGERS (auto-update timestamps)
-- ============================================================================
CREATE OR REPLACE FUNCTION onenote.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notebooks_timestamp
  BEFORE UPDATE ON onenote.notebooks
  FOR EACH ROW EXECUTE FUNCTION onenote.update_updated_at();

CREATE TRIGGER update_sections_timestamp
  BEFORE UPDATE ON onenote.sections
  FOR EACH ROW EXECUTE FUNCTION onenote.update_updated_at();

CREATE TRIGGER update_pages_timestamp
  BEFORE UPDATE ON onenote.pages
  FOR EACH ROW EXECUTE FUNCTION onenote.update_updated_at();
