-- Metaflow Functions
-- Core PL/pgSQL functions for the ontology platform
-- Consolidated from Metaflow with full submission criteria evaluation

-- ============================================================================
-- Generate Semantic ID (e.g., "customer-01", "order-42")
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.generate_semantic_id(
  p_tenant_id UUID,
  p_object_type_id UUID,
  p_display_name TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_semantic_id TEXT;
  v_next_number INTEGER;
  v_max_attempts INTEGER := 10;
  v_attempt INTEGER := 0;
BEGIN
  -- Generate prefix from display name (lowercase, kebab-case)
  v_prefix := lower(regexp_replace(
    regexp_replace(
      regexp_replace(p_display_name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  ));
  v_prefix := trim(both '-' from v_prefix);

  -- Fallback if empty
  IF v_prefix = '' THEN
    v_prefix := 'object';
  END IF;

  -- Retry loop to handle race conditions
  LOOP
    v_attempt := v_attempt + 1;

    IF v_attempt > v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate semantic_id after % attempts', v_max_attempts;
    END IF;

    -- Find maximum existing number for this prefix
    SELECT COALESCE(MAX(
      CASE
        WHEN semantic_id ~ ('^' || v_prefix || '-[0-9]+$')
        THEN substring(semantic_id from '[0-9]+$')::INTEGER
        ELSE 0
      END
    ), 0) INTO v_next_number
    FROM metaflow.objects
    WHERE tenant_id = p_tenant_id
      AND object_type_id = p_object_type_id
      AND semantic_id LIKE v_prefix || '-%';

    v_next_number := v_next_number + 1;

    -- Format as prefix-01, prefix-02, etc.
    v_semantic_id := v_prefix || '-' || lpad(v_next_number::text, 2, '0');

    -- Check if this ID already exists
    PERFORM 1 FROM metaflow.objects
    WHERE tenant_id = p_tenant_id
      AND semantic_id = v_semantic_id;

    IF NOT FOUND THEN
      RETURN v_semantic_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION metaflow.generate_semantic_id IS 'Generates semantic IDs like customer-01 by finding max existing number and incrementing';

-- ============================================================================
-- Validate Action Parameters
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.validate_action_parameters(
  p_action_type_id UUID,
  p_tenant_id UUID,
  p_parameters JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_config JSONB;
  v_param_defs JSONB;
  v_param_def JSONB;
  v_param_name TEXT;
  v_param_value JSONB;
  v_required BOOLEAN;
  v_param_type TEXT;
  v_errors JSONB := '[]'::JSONB;
BEGIN
  -- Get action config
  SELECT config INTO v_config
  FROM metaflow.action_types
  WHERE id = p_action_type_id AND tenant_id = p_tenant_id;

  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', jsonb_build_array('Action type not found')
    );
  END IF;

  v_param_defs := v_config->'parameters';

  -- Validate each parameter
  FOR v_param_def IN SELECT * FROM jsonb_array_elements(v_param_defs)
  LOOP
    v_param_name := v_param_def->>'name';
    v_required := COALESCE((v_param_def->>'required')::BOOLEAN, false);
    v_param_type := v_param_def->>'type';
    v_param_value := p_parameters->v_param_name;

    -- Check required parameters
    IF v_required AND v_param_value IS NULL THEN
      v_errors := v_errors || jsonb_build_object(
        'parameter', v_param_name,
        'error', 'Required parameter missing'
      );
      CONTINUE;
    END IF;

    -- Type validation for object-reference
    IF v_param_type = 'object-reference' AND v_param_value IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM metaflow.objects
        WHERE id = (v_param_value->>0)::UUID
          AND tenant_id = p_tenant_id
      ) THEN
        v_errors := v_errors || jsonb_build_object(
          'parameter', v_param_name,
          'error', 'Referenced object not found'
        );
      END IF;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_errors) = 0 THEN
    RETURN jsonb_build_object('valid', true);
  ELSE
    RETURN jsonb_build_object('valid', false, 'errors', v_errors);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION metaflow.validate_action_parameters IS 'Validates action parameters against action type config';

-- ============================================================================
-- List Actions (for workspace dropdown)
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.list_actions(p_tenant_id UUID)
RETURNS TABLE(
  id UUID,
  display_name TEXT,
  execution_type TEXT,
  parameters JSONB,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.display_name,
    a.config->>'executionType' AS execution_type,
    a.config->'parameters' AS parameters,
    COALESCE(a.config->>'description', '') AS description
  FROM metaflow.action_types a
  WHERE a.tenant_id = p_tenant_id
  ORDER BY a.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Get Property Type (helper)
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.get_property_type(
  p_object_type_id UUID,
  p_property_key TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_property_def JSONB;
  v_type TEXT;
BEGIN
  SELECT config->'properties'->p_property_key INTO v_property_def
  FROM metaflow.object_types
  WHERE id = p_object_type_id;

  IF v_property_def IS NULL THEN
    RETURN 'string';
  END IF;

  v_type := v_property_def->>'type';
  RETURN COALESCE(v_type, 'string');
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Get SQL Type Cast for Property Type
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.get_type_cast(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_type
    WHEN 'number' THEN RETURN '::NUMERIC';
    WHEN 'boolean' THEN RETURN '::BOOLEAN';
    WHEN 'timestamp' THEN RETURN '::TIMESTAMPTZ';
    WHEN 'object-reference' THEN RETURN '::UUID';
    ELSE RETURN ''; -- string and others don't need casting
  END CASE;
END;
$$;

-- ============================================================================
-- List Tenant Views
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.list_tenant_views(p_tenant_id UUID)
RETURNS TABLE(
  view_name TEXT,
  object_type_id UUID,
  object_type_name TEXT,
  schema_hash TEXT,
  generation_status TEXT,
  generated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vm.view_name,
    vm.object_type_id,
    ot.display_name AS object_type_name,
    vm.schema_hash,
    vm.generation_status,
    vm.generated_at
  FROM metaflow.view_metadata vm
  JOIN metaflow.object_types ot ON vm.object_type_id = ot.id
  WHERE vm.tenant_id = p_tenant_id
  ORDER BY ot.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUBMISSION CRITERIA EVALUATION SYSTEM
-- ============================================================================

-- ============================================================================
-- Build Property Path SQL with Type Casting
-- Supports M:1, 1:M, M:N relationship traversal
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.build_property_path_sql(
  p_path JSONB,
  p_base_alias TEXT,
  p_parameters JSONB,
  p_tenant_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_param TEXT;
  v_base_object_id UUID;
  v_base_object_type_id UUID;
  v_base_view TEXT;
  v_segments JSONB;
  v_current_alias TEXT;
  v_current_type_id UUID;
  v_property_key TEXT;
  v_property_type TEXT;
  v_type_cast TEXT;
  v_sql TEXT;
  v_joins TEXT := '';
  v_segment JSONB;
  v_next_alias TEXT;
  v_next_type_id UUID;
  v_next_view TEXT;
  v_relationship_type TEXT;
BEGIN
  -- Get base object ID from parameters
  v_base_param := p_path->>'baseParameterName';
  v_base_object_id := (p_parameters->>v_base_param)::UUID;

  IF v_base_object_id IS NULL THEN
    RAISE EXCEPTION 'Parameter % not found', v_base_param;
  END IF;

  -- Get base object type and view
  SELECT object_type_id INTO v_base_object_type_id
  FROM metaflow.objects
  WHERE id = v_base_object_id AND tenant_id = p_tenant_id;

  SELECT view_name INTO v_base_view
  FROM metaflow.view_metadata
  WHERE object_type_id = v_base_object_type_id AND tenant_id = p_tenant_id;

  -- If no view, fall back to direct object query
  IF v_base_view IS NULL THEN
    -- Direct query from objects table using data JSONB
    v_property_key := p_path->>'terminalPropertyKey';
    v_property_type := metaflow.get_property_type(v_base_object_type_id, v_property_key);
    v_type_cast := metaflow.get_type_cast(v_property_type);

    RETURN format('(SELECT (data->>%L)%s FROM metaflow.objects WHERE id = %L)',
      v_property_key,
      v_type_cast,
      v_base_object_id
    );
  END IF;

  -- Start with base
  v_current_alias := p_base_alias;
  v_current_type_id := v_base_object_type_id;
  v_segments := p_path->'segments';

  -- Build JOINs for each segment
  IF v_segments IS NOT NULL AND jsonb_typeof(v_segments) = 'array' AND jsonb_array_length(v_segments) > 0 THEN
    FOR i IN 0..(jsonb_array_length(v_segments) - 1) LOOP
      v_segment := v_segments->i;
      v_property_key := v_segment->>'propertyKey';
      v_relationship_type := v_segment->>'relationshipType';
      v_next_type_id := (v_segment->>'objectTypeId')::UUID;
      v_next_alias := 'j' || i::TEXT;

      IF v_relationship_type = 'M:1' THEN
        -- Get property type for FK (should be object-reference)
        v_property_type := metaflow.get_property_type(v_current_type_id, v_property_key);
        v_type_cast := metaflow.get_type_cast(v_property_type);

        -- Get target view name
        SELECT view_name INTO v_next_view
        FROM metaflow.view_metadata
        WHERE object_type_id = v_next_type_id AND tenant_id = p_tenant_id;

        -- M:1: FK join with proper casting
        v_joins := v_joins || format(
          ' JOIN %I AS %I ON %I.%I%s = %I.id',
          v_next_view,
          v_next_alias,
          v_current_alias,
          v_property_key,
          v_type_cast,
          v_next_alias
        );

        v_current_alias := v_next_alias;
        v_current_type_id := v_next_type_id;

      ELSIF v_relationship_type = 'M:N' THEN
        -- M:N: Return special marker for EXISTS handling
        RETURN 'M:N:' || v_base_object_id::TEXT || ':' || v_current_type_id::TEXT || ':' ||
               (v_segment->>'quantifier') || ':' || v_property_key || ':' || v_next_type_id::TEXT;
      END IF;
    END LOOP;
  END IF;

  -- Build final SELECT for terminal property with type casting
  v_property_key := p_path->>'terminalPropertyKey';
  v_property_type := metaflow.get_property_type(v_current_type_id, v_property_key);
  v_type_cast := metaflow.get_type_cast(v_property_type);

  v_sql := format('(SELECT %I.%I%s FROM %I AS %I%s WHERE %I.id = %L)',
    v_current_alias,
    v_property_key,
    v_type_cast,
    v_base_view,
    p_base_alias,
    v_joins,
    p_base_alias,
    v_base_object_id
  );

  RETURN v_sql;
END;
$$;

-- ============================================================================
-- Build M:N EXISTS Query with Type Casting
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.build_m2n_exists_sql(
  p_marker TEXT,
  p_terminal_property TEXT,
  p_operator TEXT,
  p_right_value TEXT,
  p_tenant_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_parts TEXT[];
  v_base_object_id UUID;
  v_base_type_id UUID;
  v_quantifier TEXT;
  v_property_key TEXT;
  v_target_type_id UUID;
  v_target_view TEXT;
  v_terminal_type TEXT;
  v_type_cast TEXT;
  v_comparison TEXT;
  v_sql TEXT;
BEGIN
  -- Parse M:N marker: M:N:base_id:base_type:quantifier:property_key:target_type
  v_parts := string_to_array(p_marker, ':');
  v_base_object_id := v_parts[3]::UUID;
  v_base_type_id := v_parts[4]::UUID;
  v_quantifier := v_parts[5];
  v_property_key := v_parts[6];
  v_target_type_id := v_parts[7]::UUID;

  -- Get target view
  SELECT view_name INTO v_target_view
  FROM metaflow.view_metadata
  WHERE object_type_id = v_target_type_id AND tenant_id = p_tenant_id;

  -- Get terminal property type and cast
  v_terminal_type := metaflow.get_property_type(v_target_type_id, p_terminal_property);
  v_type_cast := metaflow.get_type_cast(v_terminal_type);

  -- Build comparison based on operator
  CASE p_operator
    WHEN '=' THEN
      v_comparison := format('target.%I%s = %L%s',
        p_terminal_property, v_type_cast, p_right_value, v_type_cast);
    WHEN '!=' THEN
      v_comparison := format('target.%I%s != %L%s',
        p_terminal_property, v_type_cast, p_right_value, v_type_cast);
    WHEN '>' THEN
      v_comparison := format('target.%I::NUMERIC > %L::NUMERIC',
        p_terminal_property, p_right_value);
    WHEN '>=' THEN
      v_comparison := format('target.%I::NUMERIC >= %L::NUMERIC',
        p_terminal_property, p_right_value);
    WHEN '<' THEN
      v_comparison := format('target.%I::NUMERIC < %L::NUMERIC',
        p_terminal_property, p_right_value);
    WHEN '<=' THEN
      v_comparison := format('target.%I::NUMERIC <= %L::NUMERIC',
        p_terminal_property, p_right_value);
    WHEN 'LIKE' THEN
      v_comparison := format('target.%I LIKE ''%%'' || %L || ''%%''',
        p_terminal_property, p_right_value);
    WHEN 'NOT LIKE' THEN
      v_comparison := format('target.%I NOT LIKE ''%%'' || %L || ''%%''',
        p_terminal_property, p_right_value);
    WHEN 'STARTS' THEN
      v_comparison := format('target.%I LIKE %L || ''%%''',
        p_terminal_property, p_right_value);
    WHEN 'ENDS' THEN
      v_comparison := format('target.%I LIKE ''%%'' || %L',
        p_terminal_property, p_right_value);
    WHEN 'NULL' THEN
      v_comparison := format('target.%I IS NULL', p_terminal_property);
    WHEN 'NOT NULL' THEN
      v_comparison := format('target.%I IS NOT NULL', p_terminal_property);
    -- Legacy operators (backward compatibility)
    WHEN 'equals' THEN
      v_comparison := format('target.%I%s = %L%s',
        p_terminal_property, v_type_cast, p_right_value, v_type_cast);
    WHEN 'not_equals' THEN
      v_comparison := format('target.%I%s != %L%s',
        p_terminal_property, v_type_cast, p_right_value, v_type_cast);
    ELSE
      RAISE EXCEPTION 'Unsupported operator: %', p_operator;
  END CASE;

  -- Build EXISTS query
  IF v_quantifier = 'ANY' THEN
    v_sql := format(
      'EXISTS (SELECT 1 FROM metaflow.relations r JOIN %I AS target ON target.id = r.target_id WHERE r.source_id = %L AND r.relation_type = %L AND %s)',
      v_target_view,
      v_base_object_id,
      v_property_key,
      v_comparison
    );
  ELSE -- ALL
    -- ALL: None must NOT match (flip comparison)
    v_sql := format(
      'NOT EXISTS (SELECT 1 FROM metaflow.relations r JOIN %I AS target ON target.id = r.target_id WHERE r.source_id = %L AND r.relation_type = %L AND NOT (%s))',
      v_target_view,
      v_base_object_id,
      v_property_key,
      v_comparison
    );
  END IF;

  RETURN v_sql;
END;
$$;

-- ============================================================================
-- Evaluate Comparison Expression
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.evaluate_comparison(
  p_expression JSONB,
  p_parameters JSONB,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_operator TEXT;
  v_left_sql TEXT;
  v_right_sql TEXT;
  v_left_value TEXT;
  v_right_value TEXT;
  v_comparison_sql TEXT;
  v_passed BOOLEAN;
BEGIN
  v_operator := p_expression->>'operator';

  -- Build SQL for left operand
  CASE p_expression->'left'->>'type'
    WHEN 'property' THEN
      v_left_sql := metaflow.build_property_path_sql(
        p_expression->'left'->'path',
        'base',
        p_parameters,
        p_tenant_id
      );
    WHEN 'static' THEN
      v_left_sql := quote_literal(p_expression->'left'->>'value');
    WHEN 'parameter' THEN
      v_left_sql := quote_literal(p_parameters->>(p_expression->'left'->>'parameterName'));
    WHEN 'system' THEN
      IF p_expression->'left'->>'systemValue' = 'current_user' THEN
        v_left_sql := quote_literal(p_parameters->>'_current_user');
      ELSIF p_expression->'left'->>'systemValue' = 'current_timestamp' THEN
        v_left_sql := 'NOW()';
      END IF;
    ELSE
      v_left_sql := 'NULL';
  END CASE;

  -- Build SQL for right operand
  CASE p_expression->'right'->>'type'
    WHEN 'static' THEN
      v_right_sql := quote_literal(p_expression->'right'->>'value');
    WHEN 'parameter' THEN
      v_right_sql := quote_literal(p_parameters->>(p_expression->'right'->>'parameterName'));
    ELSE
      v_right_sql := 'NULL';
  END CASE;

  -- Check if left is M:N marker
  IF v_left_sql LIKE 'M:N:%' THEN
    EXECUTE 'SELECT ' || v_right_sql INTO v_right_value;

    v_comparison_sql := metaflow.build_m2n_exists_sql(
      v_left_sql,
      p_expression->'left'->'path'->>'terminalPropertyKey',
      v_operator,
      v_right_value,
      p_tenant_id
    );

    EXECUTE 'SELECT ' || v_comparison_sql INTO v_passed;

    RETURN jsonb_build_object(
      'expression', p_expression,
      'result', v_passed,
      'details', format('M:N[%s] %s → %s',
        split_part(v_left_sql, ':', 5), v_operator,
        CASE WHEN v_passed THEN 'PASS' ELSE 'FAIL' END)
    );
  END IF;

  -- Execute to get actual values
  EXECUTE 'SELECT ' || v_left_sql INTO v_left_value;
  EXECUTE 'SELECT ' || v_right_sql INTO v_right_value;

  -- Build comparison SQL based on operator
  CASE v_operator
    WHEN '=' THEN
      v_comparison_sql := format('%s = %s', v_left_sql, v_right_sql);
    WHEN '!=' THEN
      v_comparison_sql := format('(%s != %s OR (%s IS NULL AND %s IS NOT NULL) OR (%s IS NOT NULL AND %s IS NULL))',
        v_left_sql, v_right_sql, v_left_sql, v_right_sql, v_left_sql, v_right_sql);
    WHEN '>' THEN
      v_comparison_sql := format('%s > %s', v_left_sql, v_right_sql);
    WHEN '>=' THEN
      v_comparison_sql := format('%s >= %s', v_left_sql, v_right_sql);
    WHEN '<' THEN
      v_comparison_sql := format('%s < %s', v_left_sql, v_right_sql);
    WHEN '<=' THEN
      v_comparison_sql := format('%s <= %s', v_left_sql, v_right_sql);
    WHEN 'LIKE' THEN
      v_comparison_sql := format('%s LIKE ''%%'' || %s || ''%%''', v_left_sql, v_right_sql);
    WHEN 'NOT LIKE' THEN
      v_comparison_sql := format('%s NOT LIKE ''%%'' || %s || ''%%''', v_left_sql, v_right_sql);
    WHEN 'STARTS' THEN
      v_comparison_sql := format('%s LIKE %s || ''%%''', v_left_sql, v_right_sql);
    WHEN 'ENDS' THEN
      v_comparison_sql := format('%s LIKE ''%%'' || %s', v_left_sql, v_right_sql);
    WHEN 'NULL' THEN
      v_comparison_sql := format('%s IS NULL', v_left_sql);
    WHEN 'NOT NULL' THEN
      v_comparison_sql := format('%s IS NOT NULL', v_left_sql);
    -- Legacy operators
    WHEN 'equals' THEN
      v_comparison_sql := format('%s = %s', v_left_sql, v_right_sql);
    WHEN 'not_equals' THEN
      v_comparison_sql := format('%s != %s', v_left_sql, v_right_sql);
    WHEN 'gt' THEN
      v_comparison_sql := format('%s > %s', v_left_sql, v_right_sql);
    WHEN 'gte' THEN
      v_comparison_sql := format('%s >= %s', v_left_sql, v_right_sql);
    WHEN 'lt' THEN
      v_comparison_sql := format('%s < %s', v_left_sql, v_right_sql);
    WHEN 'lte' THEN
      v_comparison_sql := format('%s <= %s', v_left_sql, v_right_sql);
    ELSE
      RAISE EXCEPTION 'Unsupported operator: %', v_operator;
  END CASE;

  -- Execute comparison
  EXECUTE 'SELECT ' || v_comparison_sql INTO v_passed;

  RETURN jsonb_build_object(
    'expression', p_expression,
    'result', COALESCE(v_passed, FALSE),
    'details', format('%s %s %s → %s',
      COALESCE(v_left_value, 'null'),
      v_operator,
      COALESCE(v_right_value, 'null'),
      CASE WHEN v_passed THEN 'PASS' ELSE 'FAIL' END
    ),
    'actualValue', v_left_value,
    'expectedValue', v_right_value
  );
END;
$$;

-- ============================================================================
-- Evaluate Expression (Recursive for AND/OR/NOT)
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.evaluate_expression(
  p_expression JSONB,
  p_parameters JSONB,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_expr_type TEXT;
  v_operator TEXT;
  v_child_result JSONB;
  v_child_traces JSONB[] := '{}';
  v_passed BOOLEAN;
  v_pass_count INT := 0;
  v_total_count INT;
BEGIN
  v_expr_type := p_expression->>'type';

  IF v_expr_type = 'comparison' THEN
    RETURN metaflow.evaluate_comparison(p_expression, p_parameters, p_tenant_id);
  ELSIF v_expr_type = 'logical' THEN
    v_operator := p_expression->>'operator';
    v_total_count := COALESCE(
      CASE
        WHEN jsonb_typeof(p_expression->'expressions') = 'array' THEN jsonb_array_length(p_expression->'expressions')
        ELSE 0
      END,
      0
    );

    -- Handle NOT
    IF v_operator = 'NOT' THEN
      IF v_total_count != 1 THEN
        RAISE EXCEPTION 'NOT requires exactly one expression';
      END IF;

      v_child_result := metaflow.evaluate_expression(
        p_expression->'expressions'->0,
        p_parameters,
        p_tenant_id
      );

      v_passed := NOT (v_child_result->>'result')::BOOLEAN;

      RETURN jsonb_build_object(
        'expression', p_expression,
        'result', v_passed,
        'details', format('NOT (%s) → %s', v_child_result->>'result',
          CASE WHEN v_passed THEN 'PASS' ELSE 'FAIL' END),
        'children', jsonb_build_array(v_child_result)
      );
    END IF;

    -- Handle AND/OR with short-circuit
    FOR i IN 0..(v_total_count - 1) LOOP
      v_child_result := metaflow.evaluate_expression(
        p_expression->'expressions'->i,
        p_parameters,
        p_tenant_id
      );

      v_child_traces := array_append(v_child_traces, v_child_result);

      IF (v_child_result->>'result')::BOOLEAN THEN
        v_pass_count := v_pass_count + 1;
      END IF;

      -- Short-circuit
      IF v_operator = 'AND' AND NOT (v_child_result->>'result')::BOOLEAN THEN
        v_passed := FALSE;
        EXIT;
      ELSIF v_operator = 'OR' AND (v_child_result->>'result')::BOOLEAN THEN
        v_passed := TRUE;
        EXIT;
      END IF;
    END LOOP;

    -- Final result if not short-circuited
    IF v_passed IS NULL THEN
      v_passed := CASE v_operator
        WHEN 'AND' THEN v_pass_count = v_total_count
        WHEN 'OR' THEN v_pass_count > 0
        ELSE FALSE
      END;
    END IF;

    RETURN jsonb_build_object(
      'expression', p_expression,
      'result', v_passed,
      'details', format('%s (%s/%s passed) → %s',
        v_operator, v_pass_count, v_total_count,
        CASE WHEN v_passed THEN 'PASS' ELSE 'FAIL' END
      ),
      'children', array_to_json(v_child_traces)
    );
  END IF;

  RAISE EXCEPTION 'Unknown expression type: %', v_expr_type;
END;
$$;

-- ============================================================================
-- Main Submission Criteria Evaluator
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.evaluate_submission_criteria(
  p_expression JSONB,
  p_parameters JSONB,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trace JSONB;
  v_passed BOOLEAN;
BEGIN
  IF p_expression IS NULL THEN
    RETURN jsonb_build_object('passed', TRUE, 'trace', NULL);
  END IF;

  IF p_parameters IS NULL THEN
    RAISE EXCEPTION 'Parameters cannot be null';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID cannot be null';
  END IF;

  v_trace := metaflow.evaluate_expression(p_expression, p_parameters, p_tenant_id);
  v_passed := (v_trace->>'result')::BOOLEAN;

  RETURN jsonb_build_object(
    'passed', v_passed,
    'trace', v_trace
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'passed', FALSE,
    'error', SQLERRM,
    'trace', jsonb_build_object(
      'expression', p_expression,
      'result', FALSE,
      'details', 'Evaluation error: ' || SQLERRM
    )
  );
END;
$$;

COMMENT ON FUNCTION metaflow.evaluate_submission_criteria IS 'Evaluates complex submission criteria with property path traversal and logical operators';

-- ============================================================================
-- SMART ACTION FILTERING HELPERS
-- ============================================================================

-- ============================================================================
-- Get Object Current State
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.get_object_current_state(
  p_object_type_id UUID,
  p_object_data JSONB,
  p_tenant_id UUID
)
RETURNS TABLE(current_state TEXT, state_property TEXT) AS $$
DECLARE
  v_state_property TEXT;
BEGIN
  -- Get primary state property from process
  SELECT (tracked_picklists->0)::TEXT INTO v_state_property
  FROM metaflow.process_layouts
  WHERE p_object_type_id = ANY(object_type_ids) AND tenant_id = p_tenant_id
  LIMIT 1;

  IF v_state_property IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Remove quotes if present (JSON string)
  v_state_property := trim(both '"' from v_state_property);

  RETURN QUERY SELECT p_object_data->>v_state_property, v_state_property;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Evaluate Action Criteria for Object
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.evaluate_action_criteria(
  p_criteria JSONB,
  p_object_id UUID,
  p_tenant_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_result JSONB;
  v_param_name TEXT;
  v_parameters JSONB;
  v_normalized_criteria JSONB;
BEGIN
  -- Normalize criteria: handle both single object and array formats
  IF p_criteria IS NULL THEN
    RETURN TRUE; -- No criteria = always available
  END IF;

  -- Convert single object to array (backward compatibility)
  IF jsonb_typeof(p_criteria) = 'object' THEN
    v_normalized_criteria := jsonb_build_array(p_criteria);
  ELSIF jsonb_typeof(p_criteria) = 'array' THEN
    v_normalized_criteria := p_criteria;
  ELSE
    RETURN TRUE; -- Invalid format = treat as no criteria
  END IF;

  -- Check if array is empty
  IF jsonb_array_length(v_normalized_criteria) = 0 THEN
    RETURN TRUE;
  END IF;

  -- Extract parameter name from criteria
  v_param_name := v_normalized_criteria->0->'left'->'path'->>'baseParameterName';

  -- If no parameter name found, default to 'object'
  IF v_param_name IS NULL THEN
    v_param_name := 'object';
  END IF;

  -- Build parameters object with correct parameter name
  v_parameters := jsonb_build_object(v_param_name, p_object_id::TEXT);

  -- Evaluate first criteria
  v_result := metaflow.evaluate_submission_criteria(
    v_normalized_criteria->0,
    v_parameters,
    p_tenant_id
  );

  RETURN COALESCE((v_result->>'passed')::BOOLEAN, FALSE);
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE; -- Criteria evaluation failed = not available
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Check if Action is Recommended for Current State
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.is_action_recommended(
  p_action_id UUID,
  p_current_state TEXT,
  p_tenant_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_config JSONB;
  v_source_state TEXT;
BEGIN
  IF p_current_state IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT a.config INTO v_config
  FROM metaflow.action_types a
  WHERE a.id = p_action_id AND a.tenant_id = p_tenant_id;

  -- Extract source state from submission criteria
  v_source_state := v_config->'submissionCriteria'->0->'right'->>'value';

  RETURN v_source_state = p_current_state;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Classify Action for Object
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.classify_action_for_object(
  p_action_id UUID,
  p_object_type_id UUID,
  p_object_data JSONB,
  p_current_state TEXT,
  p_tenant_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_config JSONB;
  v_has_criteria BOOLEAN := FALSE;
BEGIN
  SELECT a.config INTO v_config
  FROM metaflow.action_types a
  WHERE a.id = p_action_id AND a.tenant_id = p_tenant_id;

  -- Check if action has submission criteria
  v_has_criteria := v_config->'submissionCriteria' IS NOT NULL
    AND jsonb_array_length(COALESCE(v_config->'submissionCriteria', '[]'::JSONB)) > 0;

  -- Classify
  IF v_has_criteria THEN
    IF metaflow.is_action_recommended(p_action_id, p_current_state, p_tenant_id) THEN
      RETURN 'recommended';
    ELSE
      RETURN 'conditional';
    END IF;
  ELSE
    RETURN 'independent';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Calculate Action Priority Score (0-200)
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.calculate_action_priority(
  p_classification TEXT,
  p_criteria_passed BOOLEAN
)
RETURNS INTEGER AS $$
BEGIN
  CASE
    WHEN NOT p_criteria_passed THEN RETURN 0;      -- Failed criteria = lowest
    WHEN p_classification = 'recommended' THEN RETURN 200;  -- Highest
    WHEN p_classification = 'independent' THEN RETURN 150;  -- High
    WHEN p_classification = 'transition' THEN RETURN 100;   -- Medium
    ELSE RETURN 50;  -- Conditional = lower
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Execute Action (with criteria enforcement)
-- ============================================================================
CREATE OR REPLACE FUNCTION metaflow.execute_action(
  p_action_type_id UUID,
  p_tenant_id UUID,
  p_parameters JSONB,
  p_current_user UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_config JSONB;
  v_execution_type TEXT;
  v_validation JSONB;
  v_criteria_result JSONB;
  v_rules JSONB;
  v_rule JSONB;
  v_rule_type TEXT;
  v_results JSONB := '[]'::JSONB;
  v_result JSONB;
  v_data JSONB;
  v_prop_key TEXT;
  v_prop_config JSONB;
  v_object_id UUID;
  v_function_name TEXT;
  v_function_result JSONB;
BEGIN
  -- Get action config
  SELECT config INTO v_config
  FROM metaflow.action_types
  WHERE id = p_action_type_id AND tenant_id = p_tenant_id;

  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Action type not found'
    );
  END IF;

  v_execution_type := v_config->>'executionType';

  -- Validate parameters
  v_validation := metaflow.validate_action_parameters(p_action_type_id, p_tenant_id, p_parameters);
  IF NOT (v_validation->>'valid')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parameter validation failed',
      'details', v_validation->'errors'
    );
  END IF;

  -- Evaluate submission criteria (if defined)
  IF v_config->'submissionCriteria' IS NOT NULL
     AND jsonb_array_length(COALESCE(v_config->'submissionCriteria', '[]'::JSONB)) > 0 THEN

    v_criteria_result := metaflow.evaluate_submission_criteria(
      v_config->'submissionCriteria'->0,
      p_parameters,
      p_tenant_id
    );

    IF NOT COALESCE((v_criteria_result->>'passed')::BOOLEAN, FALSE) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Submission criteria not met',
        'details', v_criteria_result->'trace'
      );
    END IF;
  END IF;

  -- Execute based on type
  IF v_execution_type = 'declarative' THEN
    v_rules := v_config->'rules';

    FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules)
    LOOP
      v_rule_type := v_rule->>'type';

      CASE v_rule_type
        WHEN 'modify_object' THEN
          -- Build data from properties config
          v_data := '{}'::JSONB;
          IF v_rule->'properties' IS NOT NULL THEN
            FOR v_prop_key, v_prop_config IN SELECT * FROM jsonb_each(v_rule->'properties')
            LOOP
              CASE v_prop_config->>'source'
                WHEN 'static' THEN
                  v_data := v_data || jsonb_build_object(v_prop_key, v_prop_config->'value');
                WHEN 'parameter' THEN
                  v_data := v_data || jsonb_build_object(v_prop_key, p_parameters->(v_prop_config->>'parameterName'));
                WHEN 'current_user' THEN
                  v_data := v_data || jsonb_build_object(v_prop_key, p_current_user);
                WHEN 'current_timestamp' THEN
                  v_data := v_data || jsonb_build_object(v_prop_key, to_jsonb(NOW()));
                ELSE
                  NULL;
              END CASE;
            END LOOP;
          END IF;

          -- Update object data
          UPDATE metaflow.objects
          SET data = data || v_data,
              updated_at = NOW()
          WHERE id = (p_parameters->>(v_rule->>'objectParameter'))::UUID
            AND tenant_id = p_tenant_id;

          v_results := v_results || jsonb_build_object(
            'success', true,
            'type', 'modify_object',
            'objectId', p_parameters->>(v_rule->>'objectParameter')
          );

        WHEN 'create_object' THEN
          -- Build data from properties config
          v_data := '{}'::JSONB;
          IF v_rule->'properties' IS NOT NULL THEN
            FOR v_prop_key, v_prop_config IN SELECT * FROM jsonb_each(v_rule->'properties')
            LOOP
              CASE v_prop_config->>'source'
                WHEN 'static' THEN
                  v_data := v_data || jsonb_build_object(v_prop_key, v_prop_config->'value');
                WHEN 'parameter' THEN
                  v_data := v_data || jsonb_build_object(v_prop_key, p_parameters->(v_prop_config->>'parameterName'));
                WHEN 'current_user' THEN
                  v_data := v_data || jsonb_build_object(v_prop_key, p_current_user);
                WHEN 'current_timestamp' THEN
                  v_data := v_data || jsonb_build_object(v_prop_key, to_jsonb(NOW()));
                ELSE
                  NULL;
              END CASE;
            END LOOP;
          END IF;

          -- Create new object
          INSERT INTO metaflow.objects (tenant_id, object_type_id, data)
          VALUES (
            p_tenant_id,
            (v_rule->>'objectTypeId')::UUID,
            v_data
          )
          RETURNING id INTO v_object_id;

          v_results := v_results || jsonb_build_object(
            'success', true,
            'type', 'create_object',
            'objectId', v_object_id
          );

        WHEN 'delete_object' THEN
          DELETE FROM metaflow.objects
          WHERE id = (p_parameters->>(v_rule->>'objectParameter'))::UUID
            AND tenant_id = p_tenant_id;

          v_results := v_results || jsonb_build_object(
            'success', true,
            'type', 'delete_object'
          );

        WHEN 'link_objects' THEN
          v_results := v_results || jsonb_build_object(
            'success', false,
            'type', 'link_objects',
            'error', 'link_objects not yet implemented'
          );

        ELSE
          v_results := v_results || jsonb_build_object(
            'success', false,
            'error', 'Unknown rule type: ' || v_rule_type
          );
      END CASE;

      -- Stop on first failure
      IF NOT (v_results->-1->>'success')::BOOLEAN THEN
        EXIT;
      END IF;
    END LOOP;

    RETURN jsonb_build_object(
      'success', true,
      'results', v_results
    );

  ELSIF v_execution_type = 'function-backed' THEN
    v_function_name := v_config->>'functionName';

    IF v_function_name IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Function name not specified for function-backed action'
      );
    END IF;

    -- Call the custom function (must exist and return JSONB)
    EXECUTE format('SELECT %I($1, $2)', v_function_name)
    INTO v_function_result
    USING p_parameters, p_tenant_id;

    RETURN jsonb_build_object(
      'success', true,
      'results', jsonb_build_array(v_function_result)
    );

  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unknown execution type: ' || v_execution_type
    );
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION metaflow.execute_action IS 'Executes declarative or function-backed action with parameter validation and criteria enforcement';

-- ============================================================================
-- Get Available Actions for Object (with real criteria evaluation)
-- ============================================================================
-- Drop existing function first (return type changed from original)
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

  -- Return actions relevant to this object type, filtered and prioritized
  RETURN QUERY
  SELECT
    a.id,
    a.display_name,
    a.config->>'executionType' AS execution_type,
    a.config->'parameters' AS parameters,
    COALESCE(a.config->>'description', '') AS description,
    metaflow.classify_action_for_object(a.id, v_object_type_id, v_object_data, v_current_state, p_tenant_id) AS classification,
    metaflow.evaluate_action_criteria(a.config->'submissionCriteria', p_object_id, p_tenant_id) AS criteria_passed,
    metaflow.is_action_recommended(a.id, v_current_state, p_tenant_id) AS is_recommended,
    metaflow.calculate_action_priority(
      metaflow.classify_action_for_object(a.id, v_object_type_id, v_object_data, v_current_state, p_tenant_id),
      metaflow.evaluate_action_criteria(a.config->'submissionCriteria', p_object_id, p_tenant_id)
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
  ORDER BY metaflow.calculate_action_priority(
    metaflow.classify_action_for_object(a.id, v_object_type_id, v_object_data, v_current_state, p_tenant_id),
    metaflow.evaluate_action_criteria(a.config->'submissionCriteria', p_object_id, p_tenant_id)
  ) DESC, a.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION metaflow.get_available_actions_for_object IS 'Returns actions available for specific object, filtered by submission criteria and prioritized by relevance';
