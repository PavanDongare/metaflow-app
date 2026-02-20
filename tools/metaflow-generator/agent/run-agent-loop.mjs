#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import vm from 'node:vm';

function parseArgs(argv) {
  const out = {
    prompt: '',
    tenantId: '00000000-0000-0000-0000-000000000001',
    tenantName: 'Default Tenant',
    tenantSlug: 'default',
    maxIters: 8,
    provider: 'openrouter',
    model: 'openai/gpt-4.1-nano',
    referenceExamplePath: 'examples/metaflow/deal-pipeline.canonical.export.json',
    output: 'examples/metaflow/generated.agent.json',
    sqlOut: 'examples/metaflow/generated.agent.sql',
    apply: false,
    structured: true,
    verbose: true,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--prompt' && next) { out.prompt = next; i++; continue; }
    if (a === '--tenant-id' && next) { out.tenantId = next; i++; continue; }
    if (a === '--tenant-name' && next) { out.tenantName = next; i++; continue; }
    if (a === '--tenant-slug' && next) { out.tenantSlug = next; i++; continue; }
    if (a === '--max-iters' && next) { out.maxIters = Number(next); i++; continue; }
    if (a === '--provider' && next) { out.provider = next; i++; continue; }
    if (a === '--model' && next) { out.model = next; i++; continue; }
    if (a === '--reference-example' && next) { out.referenceExamplePath = next; i++; continue; }
    if (a === '--no-structured') { out.structured = false; continue; }
    if (a === '--output' && next) { out.output = next; i++; continue; }
    if (a === '--sql-out' && next) { out.sqlOut = next; i++; continue; }
    if (a === '--apply') { out.apply = true; continue; }
    if (a === '--quiet') { out.verbose = false; continue; }
  }
  return out;
}

function readEnv(key) {
  if (process.env[key]) return process.env[key];
  if (!fs.existsSync('.env.local')) return undefined;
  const raw = fs.readFileSync('.env.local', 'utf8');
  const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m?.[1]?.trim();
}

function parseJsonStrict(text) {
  const cleaned = String(text)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  const extractedObject = objectStart >= 0 && objectEnd > objectStart
    ? cleaned.slice(objectStart, objectEnd + 1)
    : cleaned;
  const candidates = [cleaned, extractedObject].filter((v, i, arr) => v && arr.indexOf(v) === i);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      const withoutBlockComments = candidate.replace(/\/\*[\s\S]*?\*\//g, '');
      const withoutLineComments = withoutBlockComments.replace(/^\s*\/\/.*$/gm, '');
      const withoutTrailingCommas = withoutLineComments.replace(/,\s*([}\]])/g, '$1');
      const normalized = withoutTrailingCommas.trim();
      try {
        return JSON.parse(normalized);
      } catch {
        // Last resort for JS-object-like output from weaker free models.
        try {
          return vm.runInNewContext(`(${normalized})`, {}, { timeout: 1000 });
        } catch {
          // Try next candidate
        }
      }
    }
  }
  throw new Error('Failed to parse agent JSON output');
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function getAction(spec, symbolicId) {
  return spec.actions.find((a) => a.symbolicId === symbolicId);
}

function applyOperation(spec, op) {
  const type = op.type;

  if (type === 'create_object_type') {
    if (!op.symbolicId || !op.displayName) throw new Error('create_object_type needs symbolicId/displayName');
    const exists = spec.objectTypes.find((o) => o.symbolicId === op.symbolicId);
    if (exists) return;
    spec.objectTypes.push({
      symbolicId: op.symbolicId,
      displayName: op.displayName,
      config: {
        titleKey: op.titleKey || 'name',
        primaryKey: op.primaryKey || 'id',
        ...(op.isJunction ? { isJunction: true } : {}),
        ...(op.junctionMetadata ? { junctionMetadata: op.junctionMetadata } : {}),
        properties: {},
      },
    });
    return;
  }

  if (type === 'upsert_attribute') {
    const obj = spec.objectTypes.find((o) => o.symbolicId === op.objectSymbolicId);
    if (!obj) throw new Error(`upsert_attribute object not found: ${op.objectSymbolicId}`);
    obj.config = obj.config || { properties: {}, titleKey: 'name' };
    obj.config.properties = obj.config.properties || {};
    obj.config.properties[op.key] = op.property;
    return;
  }

  if (type === 'create_relationship') {
    if (!op.symbolicId) throw new Error('create_relationship missing symbolicId');
    if (!op.relationship || typeof op.relationship !== 'object') {
      throw new Error('create_relationship missing relationship payload');
    }
    const exists = spec.relationships.find((r) => r?.symbolicId === op.symbolicId);
    if (exists) return;
    spec.relationships.push(op.relationship);
    return;
  }

  if (type === 'create_action') {
    if (!op.symbolicId) throw new Error('create_action missing symbolicId');
    if (!op.action || typeof op.action !== 'object') {
      throw new Error('create_action missing action payload');
    }
    if (getAction(spec, op.symbolicId)) return;
    spec.actions.push(op.action);
    return;
  }

  if (type === 'replace_action') {
    if (!op.symbolicId) throw new Error('replace_action missing symbolicId');
    const idx = spec.actions.findIndex((a) => a.symbolicId === op.symbolicId);
    if (idx === -1) throw new Error(`replace_action target not found: ${op.symbolicId}`);
    spec.actions[idx] = op.action;
    return;
  }

  if (type === 'upsert_action_parameter') {
    const action = getAction(spec, op.actionSymbolicId);
    if (!action) throw new Error(`upsert_action_parameter action not found: ${op.actionSymbolicId}`);
    action.config.parameters = ensureArray(action.config.parameters);
    const idx = action.config.parameters.findIndex((p) => p.name === op.parameter.name);
    if (idx >= 0) action.config.parameters[idx] = op.parameter;
    else action.config.parameters.push(op.parameter);
    return;
  }

  if (type === 'upsert_action_rule') {
    const action = getAction(spec, op.actionSymbolicId);
    if (!action) throw new Error(`upsert_action_rule action not found: ${op.actionSymbolicId}`);
    action.config.rules = ensureArray(action.config.rules);
    const idx = Number.isInteger(op.index) ? op.index : action.config.rules.length;
    if (idx >= 0 && idx < action.config.rules.length) action.config.rules[idx] = op.rule;
    else action.config.rules.push(op.rule);
    return;
  }

  if (type === 'set_action_submission_criteria') {
    const action = getAction(spec, op.actionSymbolicId);
    if (!action) throw new Error(`set_action_submission_criteria action not found: ${op.actionSymbolicId}`);
    action.config.submissionCriteria = ensureArray(op.submissionCriteria);
    return;
  }

  if (type === 'upsert_process_layout') {
    if (!op.processLayout || typeof op.processLayout !== 'object') {
      throw new Error('upsert_process_layout missing processLayout payload');
    }
    const existing = spec.processLayouts.find((p) => p.symbolicId === op.processLayout.symbolicId || p.processName === op.processLayout.processName);
    if (existing) {
      Object.assign(existing, op.processLayout);
    } else {
      spec.processLayouts.push(op.processLayout);
    }
    return;
  }

  if (type === 'set_pipeline_state_field') {
    const obj = spec.objectTypes.find((o) => o.symbolicId === op.objectSymbolicId);
    if (!obj) throw new Error(`set_pipeline_state_field object not found: ${op.objectSymbolicId}`);
    obj.config.properties = obj.config.properties || {};
    obj.config.properties[op.propertyKey] = op.property;
    return;
  }

  throw new Error(`Unknown operation type: ${type}`);
}

function collectSymbolicIds(spec) {
  const ids = new Set();
  for (const o of spec.objectTypes) if (o?.symbolicId) ids.add(o.symbolicId);
  for (const r of spec.relationships) if (r?.symbolicId) ids.add(r.symbolicId);
  for (const a of spec.actions) if (a?.symbolicId) ids.add(a.symbolicId);
  for (const p of spec.processLayouts) if (p?.symbolicId) ids.add(p.symbolicId);
  return ids;
}

function collectMissingRefs(node, known) {
  const missing = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') return Object.values(v).forEach(walk);
    if (typeof v === 'string' && v.startsWith('$') && !known.has(v)) missing.add(v);
  };
  walk(node);
  return [...missing];
}

function toDisplayName(symbolicId) {
  return String(symbolicId || '')
    .replace(/^\$/, '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ') || 'Entity';
}

function autoResolveMissingSymbolicRefs(spec) {
  const known = collectSymbolicIds(spec);
  const missing = collectMissingRefs(spec, known);
  if (!missing.length) return 0;

  let created = 0;
  for (const symbolicId of missing) {
    if (spec.objectTypes.some((o) => o?.symbolicId === symbolicId)) continue;
    spec.objectTypes.push({
      symbolicId,
      displayName: toDisplayName(symbolicId),
      config: {
        titleKey: 'name',
        primaryKey: 'id',
        properties: {
          name: { displayName: 'Name', type: 'string', required: true },
        },
      },
    });
    created += 1;
  }
  return created;
}

function autoResolveProcessLayout(spec) {
  const pipeline = findPipeline(spec);
  if (!pipeline) return 0;

  const hasProcess = ensureArray(spec.processLayouts).some((p) =>
    ensureArray(p?.objectTypeIds).includes(pipeline.objectSymbolicId)
  );
  if (hasProcess) return 0;

  const stages = ensureArray(pipeline.states).map((s) => ({
    id: s,
    label: s,
    value: s,
  }));

  spec.processLayouts.push({
    symbolicId: `$process_${pipeline.objectSymbolicId.replace(/^\$/, '')}`,
    processName: `${toDisplayName(pipeline.objectSymbolicId)} Workflow`,
    objectTypeIds: [pipeline.objectSymbolicId],
    trackedPicklists: [pipeline.statePropertyKey],
    stages,
    actionIds: ensureArray(spec.actions).map((a) => a?.symbolicId).filter(Boolean),
  });
  return 1;
}

function autoFillTransitionSubmissionCriteria(spec) {
  const pipeline = findPipeline(spec);
  if (!pipeline) return 0;
  const states = ensureArray(pipeline.states);
  if (states.length < 2) return 0;

  let changed = 0;
  for (const action of ensureArray(spec.actions)) {
    const rules = ensureArray(action?.config?.rules);
    const criteria = ensureArray(action?.config?.submissionCriteria);
    const modifyRule = rules.find((r) => r?.type === 'modify_object' && r?.properties?.[pipeline.statePropertyKey]?.source === 'static');
    if (!modifyRule) continue;
    if (criteria.length > 0) continue;

    const target = modifyRule?.properties?.[pipeline.statePropertyKey]?.value;
    const targetIdx = states.findIndex((s) => s === target);
    if (targetIdx === -1) continue;
    const fromIdx = targetIdx === 0 ? states.length - 1 : targetIdx - 1;
    const fromState = states[fromIdx];

    action.config.submissionCriteria = [
      {
        type: 'comparison',
        left: {
          type: 'property',
          path: {
            baseParameterName: modifyRule.objectParameter || 'deal',
            segments: [],
            terminalPropertyKey: pipeline.statePropertyKey,
          },
        },
        operator: '=',
        right: {
          type: 'static',
          value: fromState,
        },
      },
    ];
    changed += 1;
  }
  return changed;
}

function sanitizeSpecForPersistence(spec) {
  const knownObjectIds = new Set(
    ensureArray(spec.objectTypes).map((o) => o?.symbolicId).filter(Boolean)
  );

  // Ensure all entity kinds have symbolic ids.
  let relCounter = 1;
  for (const r of ensureArray(spec.relationships)) {
    if (!r.symbolicId) {
      r.symbolicId = `$relationship_${relCounter++}`;
    }
  }
  let actionCounter = 1;
  for (const a of ensureArray(spec.actions)) {
    if (!a.symbolicId) {
      a.symbolicId = `$action_${actionCounter++}`;
    }
  }

  spec.actions = ensureArray(spec.actions).map((a, idx) => {
    const fallbackDisplayName = a.displayName
      || a.name
      || a.description
      || toDisplayName(a.symbolicId || `$action_${idx + 1}`);
    const config = a.config && typeof a.config === 'object'
      ? a.config
      : {
          rules: ensureArray(a.rules),
          parameters: ensureArray(a.parameters),
          submissionCriteria: ensureArray(a.submissionCriteria),
          executionType: a.executionType || 'declarative',
        };
    return {
      ...a,
      displayName: fallbackDisplayName,
      config: {
        executionType: config.executionType || 'declarative',
        parameters: ensureArray(config.parameters),
        rules: ensureArray(config.rules),
        submissionCriteria: ensureArray(config.submissionCriteria),
      },
    };
  });

  // Normalize relationship field names expected by SQL converter.
  spec.relationships = ensureArray(spec.relationships)
    .map((r) => {
      const sourceObjectTypeId = r.sourceObjectTypeId || r.fromObjectTypeId;
      const targetObjectTypeId = r.targetObjectTypeId || r.toObjectTypeId;
      return {
        ...r,
        sourceObjectTypeId,
        targetObjectTypeId,
        cardinality: r.cardinality || 'ONE_TO_MANY',
        displayName: r.displayName || toDisplayName(r.symbolicId),
        sourceDisplayName: r.sourceDisplayName || toDisplayName(sourceObjectTypeId),
        targetDisplayName: r.targetDisplayName || toDisplayName(targetObjectTypeId),
        propertyName: r.propertyName || r.property_key || (r.cardinality === 'MANY_TO_ONE' || r.cardinality === 'ONE_TO_MANY'
          ? String((r.property?.displayName || 'relation')).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
          : null),
      };
    })
    .filter((r) => r.sourceObjectTypeId && r.targetObjectTypeId)
    .filter((r) => {
      // Avoid invalid self-relationships unless explicitly modeled as M:N junction.
      if (r.sourceObjectTypeId === r.targetObjectTypeId && r.cardinality !== 'MANY_TO_MANY') {
        return false;
      }
      return true;
    });

  // Keep process layouts minimally valid for converter.
  spec.processLayouts = ensureArray(spec.processLayouts)
    .map((p, idx) => ({
      ...p,
      processName: p.processName || `Process ${idx + 1}`,
      objectTypeIds: ensureArray(p.objectTypeIds).filter((id) => knownObjectIds.has(id)),
      trackedPicklists: ensureArray(p.trackedPicklists),
      layoutData: p.layoutData || {},
    }))
    .filter((p) => p.objectTypeIds.length > 0);
}

function findPipeline(spec) {
  for (const o of spec.objectTypes) {
    const props = o.config?.properties || {};
    for (const [key, prop] of Object.entries(props)) {
      if (prop?.type === 'string' && prop?.picklistConfig && prop.picklistConfig.allowMultiple === false && ensureArray(prop.picklistConfig.options).length >= 2) {
        return { objectSymbolicId: o.symbolicId, statePropertyKey: key, states: prop.picklistConfig.options };
      }
    }
  }
  return null;
}

function analyzeTransitions(spec, pipeline) {
  const edges = [];
  const transitionActions = [];

  for (const a of spec.actions) {
    const crit = ensureArray(a.config?.submissionCriteria)[0];
    const rules = ensureArray(a.config?.rules);
    const modify = rules.find((r) => r.type === 'modify_object' && r.properties?.[pipeline.statePropertyKey]?.source === 'static');
    const from = crit?.type === 'comparison' && crit?.left?.type === 'property' && crit?.left?.path?.terminalPropertyKey === pipeline.statePropertyKey && crit?.right?.type === 'static'
      ? crit.right.value
      : null;
    const to = modify ? modify.properties[pipeline.statePropertyKey].value : null;
    if (from && to) {
      edges.push([from, to]);
      transitionActions.push(a.symbolicId);
    }
  }

  return { edges, transitionActions };
}

function validateSpec(spec) {
  const errors = [];
  const warnings = [];

  if (!spec.objectTypes.length) errors.push('No object types defined.');
  if (!spec.actions.length) errors.push('No actions defined.');

  const known = collectSymbolicIds(spec);
  const missing = collectMissingRefs(spec, known);
  if (missing.length) errors.push(`Unknown symbolic references: ${missing.join(', ')}`);

  for (const r of spec.relationships) {
    if (r.cardinality === 'MANY_TO_MANY' && !r.junctionObjectTypeId) {
      errors.push(`Relationship ${r.symbolicId} is MANY_TO_MANY but has no junctionObjectTypeId.`);
    }
  }

  const pipeline = findPipeline(spec);
  if (!pipeline) {
    errors.push('No pipeline object found. Define a string picklist state field (allowMultiple=false) with at least 2 options.');
    return { valid: false, errors, warnings, metrics: {} };
  }

  const pipelineObj = spec.objectTypes.find((o) => o.symbolicId === pipeline.objectSymbolicId);
  if (!pipelineObj) {
    errors.push('Pipeline object symbolic ID is invalid.');
    return { valid: false, errors, warnings, metrics: {} };
  }

  const stateField = pipeline.statePropertyKey;
  const states = new Set(pipeline.states);

  for (const a of spec.actions) {
    const rules = ensureArray(a.config?.rules);
    const criteria = ensureArray(a.config?.submissionCriteria);

    const modifiesState = rules.some((r) => r.type === 'modify_object' && r.properties?.[stateField]?.source === 'static');
    const hasStateCriteria = criteria.some(
      (c) => c?.type === 'comparison' && c?.left?.type === 'property' && c?.left?.path?.terminalPropertyKey === stateField && c?.right?.type === 'static'
    );

    if (modifiesState && !hasStateCriteria) {
      errors.push(`Action ${a.symbolicId} modifies state but has no state-based submission criteria.`);
    }

    if (hasStateCriteria && !modifiesState) {
      warnings.push(`Action ${a.symbolicId} has state criteria but no state transition rule.`);
    }
  }

  const { edges, transitionActions } = analyzeTransitions(spec, pipeline);
  if (transitionActions.length < 3) {
    warnings.push(`Only ${transitionActions.length} transition action(s) detected. Real apps usually need broader transition coverage.`);
  }

  const coveredFrom = new Set(edges.map((e) => e[0]));
  for (const s of states) {
    if (!coveredFrom.has(s) && s !== 'Won' && s !== 'Lost') {
      warnings.push(`State ${s} has no outgoing transition action.`);
    }
  }

  const process = spec.processLayouts.find((p) => ensureArray(p.objectTypeIds).includes(pipeline.objectSymbolicId));
  if (!process) {
    errors.push('No process layout references the pipeline object.');
  } else if (!ensureArray(process.trackedPicklists).includes(stateField)) {
    errors.push(`Process layout ${process.processName} does not track pipeline state field: ${stateField}.`);
  }

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    warnings,
    metrics: {
      objectTypes: spec.objectTypes.length,
      relationships: spec.relationships.length,
      actions: spec.actions.length,
      processLayouts: spec.processLayouts.length,
      transitionActions: transitionActions.length,
      pipelineObject: pipeline.objectSymbolicId,
      stateField,
    },
  };
}

function compactSpecForPrompt(spec) {
  const objectTypes = ensureArray(spec.objectTypes).map((o) => {
    const properties = o?.config?.properties || {};
    const propertyKeys = Object.keys(properties);
    const stateField = propertyKeys.find((k) => {
      const p = properties[k];
      return p?.type === 'string' && p?.picklistConfig?.allowMultiple === false && ensureArray(p?.picklistConfig?.options).length >= 2;
    });
    return {
      symbolicId: o?.symbolicId,
      displayName: o?.displayName,
      titleKey: o?.config?.titleKey,
      propertyKeys,
      stateField: stateField
        ? { key: stateField, options: ensureArray(properties[stateField]?.picklistConfig?.options) }
        : null,
    };
  });

  const relationships = ensureArray(spec.relationships).map((r) => ({
    symbolicId: r?.symbolicId,
    displayName: r?.displayName,
    fromObjectTypeId: r?.fromObjectTypeId,
    toObjectTypeId: r?.toObjectTypeId,
    cardinality: r?.cardinality,
    junctionObjectTypeId: r?.junctionObjectTypeId || null,
  }));

  const actions = ensureArray(spec.actions).map((a) => {
    const params = ensureArray(a?.config?.parameters).map((p) => ({
      name: p?.name,
      objectTypeId: p?.objectTypeId,
      relationshipId: p?.relationshipId || null,
    }));
    return {
      symbolicId: a?.symbolicId,
      displayName: a?.displayName,
      parameterCount: params.length,
      parameters: params,
      ruleCount: ensureArray(a?.config?.rules).length,
      submissionCriteriaCount: ensureArray(a?.config?.submissionCriteria).length,
    };
  });

  const processLayouts = ensureArray(spec.processLayouts).map((p) => ({
    symbolicId: p?.symbolicId || null,
    processName: p?.processName,
    objectTypeIds: ensureArray(p?.objectTypeIds),
    trackedPicklists: ensureArray(p?.trackedPicklists),
    stageCount: ensureArray(p?.stages).length,
  }));

  return { objectTypes, relationships, actions, processLayouts };
}

function buildOneShotBusinessCasePrompt(userPrompt) {
  return [
    'Create a serious, production-grade process app config.',
    'Use the provided canonical Deal Pipeline example as the structural template.',
    'Mirror its depth and completeness: object model, relationships, realistic actions, submission criteria, transition rules, and process layout.',
    'The resulting config must be for this new business case only:',
    userPrompt,
  ].join('\n');
}

const SYSTEM_PROMPT = `You are MetaFlowConfigAgent.

You are generating config for a metadata builder system.
This system is defined by:
1) Object Types
2) Object attributes (properties)
3) Relationships between objects
4) Actions (each action has parameters, rules, submission criteria)
5) Process layout

Core process model (must follow exactly):
- A process flows by actions moving one pipeline entity from one state to another.
- At least one pipeline object must exist.
- Pipeline object must have a single-select state picklist field:
  property type = "string"
  picklistConfig.allowMultiple = false
  picklist options = process states
- Every transition action must include BOTH:
  a) submission criteria with previous/current state condition
  b) transition rule that writes next state

Action semantics:
- Actions are operations on objects/relationships.
- Rules perform create/modify behavior.
- Submission criteria is the guard/precondition.
- For state transitions:
  submission criteria checks current state
  modify rule sets next state

Relationship semantics:
- Use backing-entity relationships when relationship itself has attributes.
- Example relationship attributes: role, brokerName, connectedAt.
- Prefer M:N + junction/backing object when those extra fields are needed.

Reference grounding:
- The user payload includes a full canonical Deal Pipeline config.
- Treat that as the contract for quality, depth, and structure.
- Generate equivalent completeness for the new business case, not a toy config.

CRITICAL OUTPUT INSTRUCTION (HIGHEST PRIORITY):
- Return ONLY valid JSON.
- Return only one JSON object.
- No markdown, comments, prose, or code fences.
- Exact top-level shape:
{
  "summary": "string",
  "done": boolean,
  "operations": []
}

Allowed operation types and shapes:
1) create_object_type
{"type":"create_object_type","symbolicId":"$deal","displayName":"Deal","titleKey":"name","primaryKey":"id","isJunction":false}
2) upsert_attribute
{"type":"upsert_attribute","objectSymbolicId":"$deal","key":"status","property":{...PropertyDef}}
3) set_pipeline_state_field
{"type":"set_pipeline_state_field","objectSymbolicId":"$deal","propertyKey":"status","property":{"displayName":"Status","type":"string","required":true,"picklistConfig":{"allowMultiple":false,"options":["Lead","Qualified","Proposal","Negotiation","Won","Lost"]}}}
4) create_relationship
{"type":"create_relationship","symbolicId":"$deal_contacts","relationship":{...}}
5) create_action
{"type":"create_action","symbolicId":"$qualify_deal","action":{...}}
6) replace_action
{"type":"replace_action","symbolicId":"$qualify_deal","action":{...}}
7) upsert_action_parameter
{"type":"upsert_action_parameter","actionSymbolicId":"$qualify_deal","parameter":{...}}
8) upsert_action_rule
{"type":"upsert_action_rule","actionSymbolicId":"$qualify_deal","index":0,"rule":{...}}
9) set_action_submission_criteria
{"type":"set_action_submission_criteria","actionSymbolicId":"$qualify_deal","submissionCriteria":[...]}
10) upsert_process_layout
{"type":"upsert_process_layout","processLayout":{...}}

Submission criteria example shape:
{
  "type":"comparison",
  "left":{"type":"property","path":{"baseParameterName":"deal","segments":[],"terminalPropertyKey":"status"}},
  "operator":"=",
  "right":{"type":"static","value":"Qualified"}
}

Execution strategy:
- Build or patch only what is missing/invalid in currentSpec.
- Respect maxOpsThisIteration.
- Keep symbolic references consistent.
- Do not finish while reference-level completeness is still missing.
`;

const FORMATTER_PROMPT = `You are a strict JSON formatter.
CRITICAL INSTRUCTION (HIGHEST PRIORITY):
- Output MUST be valid JSON.
- Output ONLY one JSON object.
- No markdown, comments, trailing text, or code fences.

Convert the user's draft into one valid JSON object with exactly:
{
  "operations": [],
  "done": false
}

Rules:
- Keep operation objects intact if they are valid.
- If uncertain, return {"operations":[],"done":false}.
`;

async function callOpenRouterChat(client, cfg, messages, temperature, maxTokens = 700, responseFormat = undefined) {
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 90000);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://localhost',
          'X-Title': 'metaflow-agent-loop',
        },
        body: JSON.stringify({
          model: cfg.model,
          temperature,
          max_tokens: maxTokens,
          messages,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`OpenRouter error ${resp.status}: ${text}`);
      }

      const data = await resp.json();
      const message = data?.choices?.[0]?.message || {};
      const content = message?.content;
      const text = typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('\n')
          : '';
      const reasoningText = typeof message?.reasoning === 'string'
        ? message.reasoning
        : typeof message?.reasoning_content === 'string'
          ? message.reasoning_content
          : '';
      const candidate = (text && text.trim()) ? text : reasoningText;
      if (!candidate || !candidate.trim()) {
        throw new Error('OpenRouter response missing choices[0].message.content');
      }
      return candidate;
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  }
  if (lastError && (lastError.name === 'AbortError' || lastError.name === 'TimeoutError')) {
    throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
  }
  throw lastError || new Error('OpenRouter request failed');
}

async function callAgent(client, cfg, state) {
  const firstIteration = state.iteration === 1;
  const userPayload = {
    prompt: buildOneShotBusinessCasePrompt(cfg.prompt),
    originalUserPrompt: cfg.prompt,
    currentSpec: compactSpecForPrompt(state.spec),
    validation: state.validation,
    iteration: state.iteration,
    maxIterations: cfg.maxIters,
    maxOpsThisIteration: firstIteration ? 20 : 4,
    iterationGoal: firstIteration
      ? 'Create a solid first complete draft covering objects, pipeline state, relationships, actions, and process layout.'
      : 'Only patch missing/invalid parts based on validation errors/warnings.',
    referenceExample: cfg.referenceExample,
  };

  const responseFormat = cfg.structured
    ? {
        type: 'json_schema',
        json_schema: {
          name: 'metaflow_agent_step',
          strict: false,
          schema: {
            type: 'object',
            additionalProperties: true,
            properties: {
              summary: { type: 'string' },
              done: { type: 'boolean' },
              operations: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    type: { type: 'string' },
                    symbolicId: { type: 'string' },
                    displayName: { type: 'string' },
                    objectSymbolicId: { type: 'string' },
                    key: { type: 'string' },
                    property: { type: 'object', additionalProperties: true },
                    relationship: { type: 'object', additionalProperties: true },
                    action: { type: 'object', additionalProperties: true },
                    actionSymbolicId: { type: 'string' },
                    parameter: { type: 'object', additionalProperties: true },
                    index: { type: 'number' },
                    rule: { type: 'object', additionalProperties: true },
                    submissionCriteria: {
                      type: 'array',
                      items: { type: 'object', additionalProperties: true },
                    },
                    processLayout: { type: 'object', additionalProperties: true },
                    propertyKey: { type: 'string' },
                  },
                  required: ['type'],
                },
              },
            },
            required: ['done', 'operations'],
          },
        },
      }
    : undefined;
  const formatterResponseFormat = cfg.structured
    ? {
        type: 'json_schema',
        json_schema: {
          name: 'metaflow_formatter_step',
          strict: false,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              done: { type: 'boolean' },
              operations: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
            required: ['done', 'operations'],
          },
        },
      }
    : undefined;

  const draft = await callOpenRouterChat(
    client,
    cfg,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
    0.2,
    firstIteration ? 1800 : 700,
    responseFormat
  );

  try {
    return parseJsonStrict(draft);
  } catch {
    // Fallback format pass only when draft isn't parseable JSON.
  }

  const formatted = await callOpenRouterChat(
    client,
    cfg,
    [
      { role: 'system', content: FORMATTER_PROMPT },
      { role: 'user', content: draft },
    ],
    0,
    400,
    formatterResponseFormat
  );

  const formatterAttempts = [formatted];
  for (let i = 0; i < 2; i++) {
    const candidate = formatterAttempts[i];
    try {
      return parseJsonStrict(candidate);
    } catch {
      if (i === 2) break;
      const repaired = await callOpenRouterChat(
        client,
        cfg,
        [
          { role: 'system', content: FORMATTER_PROMPT },
          {
            role: 'user',
            content: `Fix this into valid JSON only (no markdown/comments):\n${candidate}`,
          },
        ],
        0,
        400,
        formatterResponseFormat
      );
      formatterAttempts.push(repaired);
    }
  }

  throw new Error('Failed to parse agent JSON output');
}

async function verifyOpenRouterModel(apiKey, model) {
  const resp = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to verify OpenRouter model: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const modelRow = (data?.data || []).find((m) => m.id === model);
  if (!modelRow) throw new Error(`Model not found on OpenRouter: ${model}`);
  return {
    prompt: String(modelRow?.pricing?.prompt ?? ''),
    completion: String(modelRow?.pricing?.completion ?? ''),
    supportedParameters: modelRow?.supported_parameters || [],
  };
}

function initSpec(cfg) {
  return {
    version: 1,
    tenant: {
      id: cfg.tenantId,
      name: cfg.tenantName,
      slug: cfg.tenantSlug,
    },
    app: {
      name: 'Generated App',
      description: `Generated from prompt: ${cfg.prompt}`,
    },
    objectTypes: [],
    relationships: [],
    actions: [],
    processLayouts: [],
  };
}

async function main() {
  const cfg = parseArgs(process.argv);
  if (!cfg.prompt) {
    console.error('Missing --prompt');
    process.exit(1);
  }

  if (cfg.provider !== 'openrouter') {
    console.error('Only provider=openrouter is supported in this project.')
    process.exit(1);
  }
  const apiKey = readEnv('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.error('Missing OPENROUTER_API_KEY (.env.local or environment)');
    process.exit(1);
  }
  const modelInfo = await verifyOpenRouterModel(apiKey, cfg.model);
  if (!cfg.referenceExamplePath || !fs.existsSync(cfg.referenceExamplePath)) {
    console.error(`Missing reference example JSON: ${cfg.referenceExamplePath}`);
    process.exit(1);
  }
  const referenceRaw = fs.readFileSync(cfg.referenceExamplePath, 'utf8');
  cfg.referenceExample = JSON.parse(referenceRaw);
  const client = { apiKey };
  const spec = initSpec(cfg);
  if (cfg.verbose) {
    console.log(`model=${cfg.model} prompt_cost=${modelInfo.prompt} completion_cost=${modelInfo.completion} structured=${cfg.structured} reference=${cfg.referenceExamplePath}`);
  }

  let validation = validateSpec(spec);
  let done = false;

  for (let i = 1; i <= cfg.maxIters; i++) {
    const state = { spec: deepClone(spec), validation, iteration: i };
    const step = await callAgent(client, cfg, state);

    const ops = ensureArray(step.operations);
    let applied = 0;

    for (const op of ops) {
      try {
        applyOperation(spec, op);
        applied += 1;
      } catch (err) {
        validation.errors.push(`Operation failed (${op?.type || 'unknown'}): ${err.message}`);
      }
    }

    applied += autoResolveMissingSymbolicRefs(spec);
    applied += autoResolveProcessLayout(spec);
    sanitizeSpecForPersistence(spec);
    applied += autoFillTransitionSubmissionCriteria(spec);
    validation = validateSpec(spec);

    if (cfg.verbose) {
      console.log(`iteration=${i} applied=${applied} valid=${validation.valid} errors=${validation.errors.length} warnings=${validation.warnings.length}`);
      if (validation.errors.length) console.log('errors:', validation.errors);
    }

    done = Boolean(step.done) && validation.valid;
    if (validation.valid || done || (validation.valid && applied === 0)) break;
  }

  fs.mkdirSync(path.dirname(cfg.output) || 'examples/metaflow', { recursive: true });
  autoResolveMissingSymbolicRefs(spec);
  autoResolveProcessLayout(spec);
  sanitizeSpecForPersistence(spec);
  autoFillTransitionSubmissionCriteria(spec);
  fs.writeFileSync(cfg.output, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

  const finalValidation = validateSpec(spec);
  console.log('\nfinal_validation:', JSON.stringify(finalValidation, null, 2));
  console.log(`wrote: ${cfg.output}`);

  if (!finalValidation.valid) {
    console.error('Final spec invalid. Fix prompt or increase --max-iters.');
    process.exit(2);
  }

  execSync(`node tools/metaflow-generator/convert-json-to-sql.mjs ${cfg.output} ${cfg.sqlOut}`, { stdio: 'inherit' });

  if (cfg.apply) {
    execSync(`node tools/metaflow-generator/apply-json-to-supabase.mjs ${cfg.output}`, { stdio: 'inherit' });
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
