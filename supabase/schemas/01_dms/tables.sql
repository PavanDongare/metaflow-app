-- DMS Schema
-- Document Management System tables

-- Create schema
CREATE SCHEMA IF NOT EXISTS dms;

-- Grant access to Supabase roles
GRANT USAGE ON SCHEMA dms TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA dms TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA dms GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ============================================================================
-- SECTIONS (per-tenant document organization)
-- ============================================================================
CREATE TABLE dms.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name TEXT NOT NULL,
  display_name TEXT,
  color TEXT,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- ============================================================================
-- DOCUMENTS (per-tenant with user audit)
-- ============================================================================
CREATE TABLE dms.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  user_id UUID,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  document_type TEXT,
  summary TEXT,
  extracted_data JSONB,
  section_id UUID REFERENCES dms.sections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MEMORY FILES (per-tenant context storage)
-- ============================================================================
CREATE TABLE dms.memory_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  filename TEXT NOT NULL,
  content TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, filename)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_dms_sections_tenant ON dms.sections(tenant_id);
CREATE INDEX idx_dms_sections_sort_order ON dms.sections(tenant_id, sort_order);
CREATE INDEX idx_dms_documents_tenant ON dms.documents(tenant_id);
CREATE INDEX idx_dms_documents_created_at ON dms.documents(tenant_id, created_at DESC);
CREATE INDEX idx_dms_documents_document_type ON dms.documents(document_type);
CREATE INDEX idx_dms_documents_section_id ON dms.documents(section_id);
CREATE INDEX idx_dms_memory_files_tenant ON dms.memory_files(tenant_id);

-- ============================================================================
-- RPC FUNCTIONS (tenant-aware)
-- ============================================================================

-- Delete documents by IDs (tenant-scoped)
CREATE OR REPLACE FUNCTION dms.delete_documents(doc_ids uuid[], p_tenant_id uuid)
RETURNS TABLE(success boolean, message text) AS $$
DECLARE
  v_deleted_count int;
BEGIN
  DELETE FROM dms.documents
  WHERE id = ANY(doc_ids) AND tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN QUERY SELECT true, 'Deleted ' || v_deleted_count || ' document(s)';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Move documents to a section (tenant-scoped)
CREATE OR REPLACE FUNCTION dms.update_section(doc_ids uuid[], new_section_name text, p_tenant_id uuid)
RETURNS TABLE(success boolean, message text) AS $$
DECLARE
  v_section_id uuid;
  v_updated_count int;
BEGIN
  -- Find existing section for this tenant
  SELECT id INTO v_section_id
  FROM dms.sections
  WHERE name = new_section_name AND tenant_id = p_tenant_id
  LIMIT 1;

  -- Create section if it doesn't exist
  IF v_section_id IS NULL THEN
    INSERT INTO dms.sections (name, tenant_id, sort_order)
    VALUES (
      new_section_name,
      p_tenant_id,
      (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM dms.sections WHERE tenant_id = p_tenant_id)
    )
    RETURNING id INTO v_section_id;
  END IF;

  -- Update documents (only those belonging to this tenant)
  UPDATE dms.documents
  SET section_id = v_section_id
  WHERE id = ANY(doc_ids) AND tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN QUERY SELECT true, 'Moved ' || v_updated_count || ' document(s) to section: ' || new_section_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
