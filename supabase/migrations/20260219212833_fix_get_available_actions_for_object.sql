DROP FUNCTION IF EXISTS metaflow.get_available_actions_for_object(UUID, UUID);

CREATE OR REPLACE FUNCTION metaflow.get_available_actions_for_object(
  p_object_id UUID,
  p_tenant_id UUID
)
RETURNS TABLE(
  id UUID,
  display_name TEXT,
  execution_type TEXT,
  parameters JSONB,
  description TEXT,
  classification TEXT,
  criteria_passed BOOLEAN,
  is_recommended BOOLEAN,
  priority_score INTEGER
) AS $$
DECLARE
  v_object_type_id UUID;
  v_object_data JSONB;
  v_current_state TEXT;
  v_state_property TEXT;
BEGIN
  -- Get object type and data
  SELECT o.object_type_id, o.data INTO v_object_type_id, v_object_data
  FROM metaflow.objects o
  WHERE o.id = p_object_id AND o.tenant_id = p_tenant_id;

  IF v_object_type_id IS NULL THEN
    RETURN;
  END IF;

  -- Get current state for recommendations
  SELECT cs.current_state, cs.state_property INTO v_current_state, v_state_property
  FROM metaflow.get_object_current_state(v_object_type_id, v_object_data, p_tenant_id) cs;

  -- Return actions relevant to this object type with safe criteria evaluation.
  -- NOTE: This intentionally avoids deep dynamic-path evaluation here to keep
  -- runtime stable for malformed/legacy criteria payloads.
  RETURN QUERY
  SELECT
    a.id,
    a.display_name,
    a.config->>'executionType' AS execution_type,
    a.config->'parameters' AS parameters,
    COALESCE(a.config->>'description', '') AS description,
    CASE
      WHEN COALESCE(jsonb_array_length(COALESCE(a.config->'submissionCriteria', '[]'::JSONB)), 0) = 0 THEN 'independent'
      WHEN (
        (a.config->'submissionCriteria'->0->>'type' = 'comparison')
        AND (a.config->'submissionCriteria'->0->'left'->>'type' = 'property')
      ) THEN
        CASE
          WHEN COALESCE(v_object_data->>(a.config->'submissionCriteria'->0->'left'->'path'->>'terminalPropertyKey'), '') =
               COALESCE(a.config->'submissionCriteria'->0->'right'->>'value', '')
          THEN 'recommended'
          ELSE 'conditional'
        END
      ELSE 'conditional'
    END AS classification,
    CASE
      WHEN COALESCE(jsonb_array_length(COALESCE(a.config->'submissionCriteria', '[]'::JSONB)), 0) = 0 THEN TRUE
      WHEN (
        (a.config->'submissionCriteria'->0->>'type' = 'comparison')
        AND (a.config->'submissionCriteria'->0->'left'->>'type' = 'property')
        AND (a.config->'submissionCriteria'->0->>'operator' IN ('=', '!=', 'equals', 'not_equals'))
      ) THEN
        CASE
          WHEN a.config->'submissionCriteria'->0->>'operator' IN ('=', 'equals') THEN
            COALESCE(v_object_data->>(a.config->'submissionCriteria'->0->'left'->'path'->>'terminalPropertyKey'), '') =
            COALESCE(a.config->'submissionCriteria'->0->'right'->>'value', '')
          ELSE
            COALESCE(v_object_data->>(a.config->'submissionCriteria'->0->'left'->'path'->>'terminalPropertyKey'), '') !=
            COALESCE(a.config->'submissionCriteria'->0->'right'->>'value', '')
        END
      ELSE TRUE
    END AS criteria_passed,
    (
      v_current_state IS NOT NULL
      AND COALESCE(a.config->'submissionCriteria'->0->'right'->>'value', '') = v_current_state
    ) AS is_recommended,
    metaflow.calculate_action_priority(
      CASE
        WHEN COALESCE(jsonb_array_length(COALESCE(a.config->'submissionCriteria', '[]'::JSONB)), 0) = 0 THEN 'independent'
        WHEN (
          (a.config->'submissionCriteria'->0->>'type' = 'comparison')
          AND (a.config->'submissionCriteria'->0->'left'->>'type' = 'property')
          AND COALESCE(v_object_data->>(a.config->'submissionCriteria'->0->'left'->'path'->>'terminalPropertyKey'), '') =
              COALESCE(a.config->'submissionCriteria'->0->'right'->>'value', '')
        ) THEN 'recommended'
        ELSE 'conditional'
      END,
      CASE
        WHEN COALESCE(jsonb_array_length(COALESCE(a.config->'submissionCriteria', '[]'::JSONB)), 0) = 0 THEN TRUE
        WHEN (
          (a.config->'submissionCriteria'->0->>'type' = 'comparison')
          AND (a.config->'submissionCriteria'->0->'left'->>'type' = 'property')
          AND (a.config->'submissionCriteria'->0->>'operator' IN ('=', 'equals', '!=', 'not_equals'))
        ) THEN
          CASE
            WHEN a.config->'submissionCriteria'->0->>'operator' IN ('=', 'equals') THEN
              COALESCE(v_object_data->>(a.config->'submissionCriteria'->0->'left'->'path'->>'terminalPropertyKey'), '') =
              COALESCE(a.config->'submissionCriteria'->0->'right'->>'value', '')
            ELSE
              COALESCE(v_object_data->>(a.config->'submissionCriteria'->0->'left'->'path'->>'terminalPropertyKey'), '') !=
              COALESCE(a.config->'submissionCriteria'->0->'right'->>'value', '')
          END
        ELSE TRUE
      END
    ) AS priority_score
  FROM metaflow.action_types a
  WHERE a.tenant_id = p_tenant_id
    AND (
      -- 1. Check if action has parameters referencing this object type
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(a.config->'parameters') AS param
        WHERE param->>'type' = 'object-reference'
          AND (param->>'objectTypeId')::UUID = v_object_type_id
      )
      OR
      -- 2. Check if action has rules referencing this object type
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(a.config->'rules') AS rule
        WHERE (
          (rule->>'type' = 'create_object' AND (rule->>'objectTypeId')::UUID = v_object_type_id)
          OR
          (
            (rule->>'type' IN ('modify_object', 'delete_object'))
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(a.config->'parameters') AS param
              WHERE param->>'name' = rule->>'objectParameter'
                AND param->>'type' = 'object-reference'
                AND (param->>'objectTypeId')::UUID = v_object_type_id
            )
          )
        )
      )
      OR
      -- 3. Check if submission criteria references this object type
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(a.config->'submissionCriteria', '[]'::JSONB)) AS criterion
        WHERE criterion->'left'->>'type' = 'property'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(a.config->'parameters') AS param
            WHERE param->>'name' = criterion->'left'->'path'->>'baseParameterName'
              AND param->>'type' = 'object-reference'
              AND (param->>'objectTypeId')::UUID = v_object_type_id
          )
      )
    )
  ORDER BY priority_score DESC, a.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION metaflow.get_available_actions_for_object IS 'Returns actions available for specific object, filtered by submission criteria and prioritized by relevance';
