#!/usr/bin/env node

/**
 * MetaFlow Config Validator
 * Usage: node tools/metaflow-generator/validate-config.mjs <path-to-json>
 */

import fs from 'node:fs';
import path from 'node:path';

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function collectSymbolicIds(spec) {
  const ids = new Set();
  for (const o of ensureArray(spec.objectTypes)) if (o?.symbolicId) ids.add(o.symbolicId);
  for (const r of ensureArray(spec.relationships)) if (r?.symbolicId) ids.add(r.symbolicId);
  for (const a of ensureArray(spec.actions)) if (a?.symbolicId) ids.add(a.symbolicId);
  for (const p of ensureArray(spec.processLayouts)) if (p?.symbolicId) ids.add(p.symbolicId);
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

function findPipeline(spec) {
  for (const o of ensureArray(spec.objectTypes)) {
    const props = o.config?.properties || {};
    for (const [key, prop] of Object.entries(props)) {
      if (prop?.type === 'string' && prop?.picklistConfig && prop.picklistConfig.allowMultiple === false && ensureArray(prop.picklistConfig.options).length >= 2) {
        return { objectSymbolicId: o.symbolicId, statePropertyKey: key, states: prop.picklistConfig.options };
      }
    }
  }
  return null;
}

function validateSpec(spec) {
  const errors = [];
  const warnings = [];

  if (!ensureArray(spec.objectTypes).length) errors.push('No object types defined.');
  if (!ensureArray(spec.actions).length) errors.push('No actions defined.');

  const known = collectSymbolicIds(spec);
  const missing = collectMissingRefs(spec, known);
  if (missing.length) errors.push(`Unknown symbolic references: ${missing.join(', ')}`);

  for (const r of ensureArray(spec.relationships)) {
    if (r.cardinality === 'MANY_TO_MANY' && !r.junctionObjectTypeId) {
      errors.push(`Relationship ${r.symbolicId} is MANY_TO_MANY but has no junctionObjectTypeId.`);
    }
  }

  const pipeline = findPipeline(spec);
  if (!pipeline) {
    errors.push('No pipeline object found. Define a string picklist state field (allowMultiple=false) with at least 2 options.');
    return { valid: false, errors, warnings };
  }

  const stateField = pipeline.statePropertyKey;
  const states = new Set(pipeline.states);

  for (const a of ensureArray(spec.actions)) {
    const rules = ensureArray(a.config?.rules);
    const criteria = ensureArray(a.config?.submissionCriteria);

    const modifiesState = rules.some((r) => r.type === 'modify_object' && r.properties?.[stateField]?.source === 'static');
    const hasStateCriteria = criteria.some(
      (c) => c?.type === 'comparison' && c?.left?.type === 'property' && c?.left?.path?.terminalPropertyKey === stateField && c?.right?.type === 'static'
    );

    if (modifiesState && !hasStateCriteria) {
      errors.push(`Action ${a.symbolicId} modifies state but has no state-based submission criteria.`);
    }
  }

  const process = ensureArray(spec.processLayouts).find((p) => ensureArray(p.objectTypeIds).includes(pipeline.objectSymbolicId));
  if (!process) {
    errors.push('No process layout references the pipeline object.');
  } else if (!ensureArray(process.trackedPicklists).includes(stateField)) {
    errors.push(`Process layout does not track pipeline state field: ${stateField}.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node validate-config.mjs <file.json>');
  process.exit(1);
}

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const spec = JSON.parse(content);
  const result = validateSpec(spec);

  if (result.valid) {
    console.log('✅ Configuration is valid.');
    if (result.warnings.length) {
      console.log('Warnings:', result.warnings);
    }
    process.exit(0);
  } else {
    console.error('❌ Configuration is invalid:');
    result.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
} catch (err) {
  console.error(`Error reading or parsing file: ${err.message}`);
  process.exit(1);
}
