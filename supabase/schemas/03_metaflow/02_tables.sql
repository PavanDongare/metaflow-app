-- Metaflow Tables
-- All core tables for the ontology platform

-- ============================================================================
-- 1. TENANTS (multi-tenant support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metaflow.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Demo tenant (hardcoded for MVP)
INSERT INTO metaflow.tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Demo Tenant', 'demo')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. OBJECT TYPES (schema definitions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metaflow.object_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES metaflow.tenants(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, display_name)
);

CREATE INDEX IF NOT EXISTS idx_mf_object_types_tenant ON metaflow.object_types(tenant_id);

COMMENT ON TABLE metaflow.object_types IS 'Object type definitions with JSONB config containing properties, titleKey, etc.';
COMMENT ON COLUMN metaflow.object_types.config IS '{
  "properties": { "propKey": { "displayName", "type", "required", "referenceConfig", "picklistConfig" } },
  "titleKey": "string",
  "primaryKey": "string",
  "isJunction": boolean,
  "junctionMetadata": { "relationshipId", "sourceObjectTypeId", "targetObjectTypeId" }
}';

-- ============================================================================
-- 3. OBJECTS (instances of object types)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metaflow.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES metaflow.tenants(id) ON DELETE CASCADE,
  object_type_id UUID NOT NULL REFERENCES metaflow.object_types(id) ON DELETE CASCADE,
  semantic_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mf_objects_tenant_type ON metaflow.objects(tenant_id, object_type_id);
CREATE INDEX IF NOT EXISTS idx_mf_objects_data ON metaflow.objects USING GIN(data);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mf_objects_semantic_id ON metaflow.objects(tenant_id, semantic_id);

COMMENT ON TABLE metaflow.objects IS 'Object instances with JSONB data matching object_type config';

-- ============================================================================
-- 4. RELATIONSHIPS (between object types)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metaflow.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES metaflow.tenants(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  cardinality TEXT NOT NULL CHECK (cardinality IN ('ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY')),
  source_object_type_id UUID NOT NULL REFERENCES metaflow.object_types(id) ON DELETE CASCADE,
  target_object_type_id UUID NOT NULL REFERENCES metaflow.object_types(id) ON DELETE CASCADE,
  source_display_name TEXT NOT NULL,
  target_display_name TEXT NOT NULL,
  junction_object_type_id UUID REFERENCES metaflow.object_types(id) ON DELETE SET NULL,
  source_fk_property_name TEXT,
  target_fk_property_name TEXT,
  property_name TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (
    (cardinality = 'MANY_TO_MANY' AND junction_object_type_id IS NOT NULL) OR
    (cardinality IN ('ONE_TO_MANY', 'MANY_TO_ONE') AND property_name IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_mf_relationships_tenant ON metaflow.relationships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mf_relationships_source ON metaflow.relationships(source_object_type_id);
CREATE INDEX IF NOT EXISTS idx_mf_relationships_target ON metaflow.relationships(target_object_type_id);

COMMENT ON TABLE metaflow.relationships IS 'Relationship definitions between object types (1:N, N:1, M:N)';

-- ============================================================================
-- 5. ACTION TYPES (declarative action definitions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metaflow.action_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES metaflow.tenants(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, display_name)
);

CREATE INDEX IF NOT EXISTS idx_mf_action_types_tenant ON metaflow.action_types(tenant_id);

COMMENT ON TABLE metaflow.action_types IS 'AI-generated action definitions with declarative config';
COMMENT ON COLUMN metaflow.action_types.config IS '{
  "executionType": "declarative" | "function-backed",
  "parameters": [{ "name", "type", "objectTypeId", "required" }],
  "rules": [{ "type": "modify_object" | "create_object" | "delete_object" | "link_objects" }],
  "submissionCriteria": [{ comparison expressions }],
  "sideEffects": [{ "type": "notification" | "webhook" }]
}';

-- ============================================================================
-- 6. VIEW METADATA (generated view tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metaflow.view_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES metaflow.tenants(id) ON DELETE CASCADE,
  object_type_id UUID NOT NULL REFERENCES metaflow.object_types(id) ON DELETE CASCADE,
  view_name TEXT NOT NULL UNIQUE,
  schema_hash TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generation_status TEXT NOT NULL CHECK (generation_status IN ('active', 'failed', 'deprecated')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, object_type_id)
);

CREATE INDEX IF NOT EXISTS idx_mf_view_metadata_tenant ON metaflow.view_metadata(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mf_view_metadata_status ON metaflow.view_metadata(generation_status);

COMMENT ON TABLE metaflow.view_metadata IS 'Tracks auto-generated views for object types';

-- ============================================================================
-- 7. ONTOLOGY LAYOUTS (visualization positions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metaflow.ontology_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES metaflow.tenants(id) ON DELETE CASCADE,
  node_positions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_mf_ontology_layouts_tenant ON metaflow.ontology_layouts(tenant_id);

COMMENT ON TABLE metaflow.ontology_layouts IS 'Stores node positions for ontology visualization';

-- ============================================================================
-- 8. PROCESS LAYOUTS (workflow canvas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metaflow.process_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES metaflow.tenants(id) ON DELETE CASCADE,
  process_name TEXT NOT NULL,
  object_type_ids UUID[] NOT NULL,
  tracked_picklists TEXT[] DEFAULT '{}',
  layout_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, process_name)
);

CREATE INDEX IF NOT EXISTS idx_mf_process_layouts_tenant ON metaflow.process_layouts(tenant_id);

COMMENT ON TABLE metaflow.process_layouts IS 'Visual layout for process/workflow canvases';

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mf_object_types_updated_at
  BEFORE UPDATE ON metaflow.object_types
  FOR EACH ROW EXECUTE FUNCTION metaflow.update_updated_at();

CREATE TRIGGER trigger_mf_objects_updated_at
  BEFORE UPDATE ON metaflow.objects
  FOR EACH ROW EXECUTE FUNCTION metaflow.update_updated_at();

CREATE TRIGGER trigger_mf_relationships_updated_at
  BEFORE UPDATE ON metaflow.relationships
  FOR EACH ROW EXECUTE FUNCTION metaflow.update_updated_at();

CREATE TRIGGER trigger_mf_action_types_updated_at
  BEFORE UPDATE ON metaflow.action_types
  FOR EACH ROW EXECUTE FUNCTION metaflow.update_updated_at();

CREATE TRIGGER trigger_mf_view_metadata_updated_at
  BEFORE UPDATE ON metaflow.view_metadata
  FOR EACH ROW EXECUTE FUNCTION metaflow.update_updated_at();

CREATE TRIGGER trigger_mf_ontology_layouts_updated_at
  BEFORE UPDATE ON metaflow.ontology_layouts
  FOR EACH ROW EXECUTE FUNCTION metaflow.update_updated_at();

CREATE TRIGGER trigger_mf_process_layouts_updated_at
  BEFORE UPDATE ON metaflow.process_layouts
  FOR EACH ROW EXECUTE FUNCTION metaflow.update_updated_at();
