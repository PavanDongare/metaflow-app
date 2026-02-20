-- Metaflow Schema: Ontology Platform
-- Creates the metaflow schema with proper grants

CREATE SCHEMA IF NOT EXISTS metaflow;

-- Grant usage to all roles
GRANT USAGE ON SCHEMA metaflow TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA metaflow TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA metaflow TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA metaflow TO anon, authenticated, service_role;

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA metaflow GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA metaflow GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA metaflow GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
