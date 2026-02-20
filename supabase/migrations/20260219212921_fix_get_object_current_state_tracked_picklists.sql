CREATE OR REPLACE FUNCTION metaflow.get_object_current_state(
  p_object_type_id UUID,
  p_object_data JSONB,
  p_tenant_id UUID
)
RETURNS TABLE(current_state TEXT, state_property TEXT) AS $$
DECLARE
  v_state_property TEXT;
BEGIN
  -- Get primary state property from process (text[] first element)
  SELECT tracked_picklists[1]::TEXT INTO v_state_property
  FROM metaflow.process_layouts
  WHERE p_object_type_id = ANY(object_type_ids) AND tenant_id = p_tenant_id
  LIMIT 1;

  IF v_state_property IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT p_object_data->>v_state_property, v_state_property;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION metaflow.get_object_current_state IS 'Returns current state and state property for object based on process tracked picklists';
