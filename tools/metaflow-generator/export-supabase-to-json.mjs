#!/usr/bin/env node

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function usage() {
  console.error('Usage: node tools/metaflow-generator/export-supabase-to-json.mjs <tenant-id> <output.json> [process-name]');
  process.exit(1);
}

if (process.argv.length < 4) usage();

const tenantId = process.argv[2];
const outputPath = process.argv[3];
const processNameFilter = process.argv[4] || null;

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');

const supabase = createClient(url, key, { db: { schema: 'metaflow' } });

function toSnakeSlug(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'item';
}

function uniqueSymbol(base, used) {
  let s = `$${base}`;
  let i = 2;
  while (used.has(s)) {
    s = `$${base}_${i}`;
    i += 1;
  }
  used.add(s);
  return s;
}

function replaceDeep(value, replacements) {
  if (Array.isArray(value)) return value.map((v) => replaceDeep(v, replacements));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceDeep(v, replacements);
    return out;
  }
  if (typeof value === 'string' && replacements.has(value)) return replacements.get(value);
  return value;
}

async function fetchTenant() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id,name,slug')
    .eq('id', tenantId)
    .single();
  if (error) throw new Error(`Failed to fetch tenant: ${error.message}`);
  return data;
}

async function fetchAll() {
  const [ot, rel, act, pl] = await Promise.all([
    supabase.from('object_types').select('*').eq('tenant_id', tenantId).order('display_name', { ascending: true }),
    supabase.from('relationships').select('*').eq('tenant_id', tenantId).order('display_name', { ascending: true }),
    supabase.from('action_types').select('*').eq('tenant_id', tenantId).order('display_name', { ascending: true }),
    supabase.from('process_layouts').select('*').eq('tenant_id', tenantId).order('process_name', { ascending: true }),
  ]);

  for (const res of [ot, rel, act, pl]) {
    if (res.error) throw new Error(res.error.message);
  }

  return {
    objectTypes: ot.data || [],
    relationships: rel.data || [],
    actions: act.data || [],
    processLayouts: pl.data || [],
  };
}

function filterByProcess(all) {
  if (!processNameFilter) return all;

  const processLayouts = all.processLayouts.filter((p) => p.process_name === processNameFilter);
  const requiredObjectTypeIds = new Set(processLayouts.flatMap((p) => p.object_type_ids || []));

  const relationships = all.relationships.filter(
    (r) => requiredObjectTypeIds.has(r.source_object_type_id) || requiredObjectTypeIds.has(r.target_object_type_id)
  );
  for (const r of relationships) {
    requiredObjectTypeIds.add(r.source_object_type_id);
    requiredObjectTypeIds.add(r.target_object_type_id);
    if (r.junction_object_type_id) requiredObjectTypeIds.add(r.junction_object_type_id);
  }

  const objectTypes = all.objectTypes.filter((o) => requiredObjectTypeIds.has(o.id));

  const actions = all.actions.filter((a) => {
    const cfg = a.config || {};
    const params = cfg.parameters || [];
    return params.some((p) => p.type === 'object-reference' && requiredObjectTypeIds.has(p.objectTypeId));
  });

  return { objectTypes, relationships, actions, processLayouts };
}

async function main() {
  const tenant = await fetchTenant();
  const all = await fetchAll();
  const filtered = filterByProcess(all);

  const usedSymbols = new Set();

  const objectSymbolById = new Map();
  for (const row of filtered.objectTypes) {
    objectSymbolById.set(row.id, uniqueSymbol(toSnakeSlug(row.display_name), usedSymbols));
  }

  const relationshipSymbolById = new Map();
  for (const row of filtered.relationships) {
    relationshipSymbolById.set(row.id, uniqueSymbol(toSnakeSlug(row.display_name), usedSymbols));
  }

  const actionSymbolById = new Map();
  for (const row of filtered.actions) {
    actionSymbolById.set(row.id, uniqueSymbol(toSnakeSlug(row.display_name), usedSymbols));
  }

  const processSymbolByKey = new Map();
  for (const row of filtered.processLayouts) {
    const key = row.id || row.process_name;
    processSymbolByKey.set(key, uniqueSymbol(`process_${toSnakeSlug(row.process_name)}`, usedSymbols));
  }

  const replacements = new Map([
    ...objectSymbolById.entries(),
    ...relationshipSymbolById.entries(),
    ...actionSymbolById.entries(),
  ]);

  const spec = {
    version: 1,
    tenant,
    app: {
      name: processNameFilter ? `${processNameFilter} Export` : 'Tenant Export',
      description: `Exported from Supabase tenant ${tenantId}${processNameFilter ? ` (${processNameFilter})` : ''}`,
    },
    objectTypes: filtered.objectTypes.map((row) => ({
      symbolicId: objectSymbolById.get(row.id),
      displayName: row.display_name,
      config: replaceDeep(row.config || {}, replacements),
    })),
    relationships: filtered.relationships.map((row) => ({
      symbolicId: relationshipSymbolById.get(row.id),
      displayName: row.display_name,
      cardinality: row.cardinality,
      sourceObjectTypeId: replacements.get(row.source_object_type_id) || row.source_object_type_id,
      targetObjectTypeId: replacements.get(row.target_object_type_id) || row.target_object_type_id,
      sourceDisplayName: row.source_display_name,
      targetDisplayName: row.target_display_name,
      ...(row.junction_object_type_id ? { junctionObjectTypeId: replacements.get(row.junction_object_type_id) || row.junction_object_type_id } : {}),
      ...(row.source_fk_property_name ? { sourceFkPropertyName: row.source_fk_property_name } : {}),
      ...(row.target_fk_property_name ? { targetFkPropertyName: row.target_fk_property_name } : {}),
      ...(row.property_name ? { propertyName: row.property_name } : {}),
      config: replaceDeep(row.config || {}, replacements),
    })),
    actions: filtered.actions.map((row) => ({
      symbolicId: actionSymbolById.get(row.id),
      displayName: row.display_name,
      config: replaceDeep(row.config || {}, replacements),
    })),
    processLayouts: filtered.processLayouts.map((row) => ({
      symbolicId: processSymbolByKey.get(row.id || row.process_name),
      processName: row.process_name,
      objectTypeIds: (row.object_type_ids || []).map((id) => replacements.get(id) || id),
      trackedPicklists: row.tracked_picklists || [],
      layoutData: replaceDeep(row.layout_data || {}, replacements),
    })),
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  console.log(`Exported JSON: ${outputPath}`);
  console.log(`objectTypes=${spec.objectTypes.length}, relationships=${spec.relationships.length}, actions=${spec.actions.length}, processLayouts=${spec.processLayouts.length}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
