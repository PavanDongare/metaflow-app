-- Verify generated config landed in DB
SELECT
  (SELECT COUNT(*) FROM metaflow.object_types WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid) AS object_types,
  (SELECT COUNT(*) FROM metaflow.relationships WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid) AS relationships,
  (SELECT COUNT(*) FROM metaflow.action_types WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid) AS action_types,
  (SELECT COUNT(*) FROM metaflow.process_layouts WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid) AS process_layouts;

SELECT id, display_name FROM metaflow.object_types WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid ORDER BY display_name;
SELECT id, display_name, cardinality FROM metaflow.relationships WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid ORDER BY display_name;
SELECT id, display_name FROM metaflow.action_types WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid ORDER BY display_name;
SELECT id, process_name, tracked_picklists FROM metaflow.process_layouts WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid ORDER BY process_name;
