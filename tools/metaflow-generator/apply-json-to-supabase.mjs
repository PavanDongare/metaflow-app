#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function usage() {
  console.error('Usage: node tools/metaflow-generator/apply-json-to-supabase.mjs <input.json>');
  process.exit(1);
}

if (process.argv.length < 3) usage();

const inputPath = process.argv[2];
const spec = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
if (!spec.tenant?.id) throw new Error('spec.tenant.id is required');

const supabase = createClient(url, key, { db: { schema: 'metaflow' } });

function deterministicUuid(seed) {
  const hex = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

const idMap = new Map();

for (const o of spec.objectTypes || []) {
  idMap.set(o.symbolicId, deterministicUuid(`${spec.tenant.id}:object:${o.symbolicId}`));
}
for (const r of spec.relationships || []) {
  idMap.set(r.symbolicId, deterministicUuid(`${spec.tenant.id}:relationship:${r.symbolicId}`));
}
for (const a of spec.actions || []) {
  idMap.set(a.symbolicId, deterministicUuid(`${spec.tenant.id}:action:${a.symbolicId}`));
}
for (const p of spec.processLayouts || []) {
  const key = p.symbolicId || `$process:${p.processName}`;
  idMap.set(key, deterministicUuid(`${spec.tenant.id}:process:${key}`));
}

function replaceSymbolsDeep(value) {
  if (Array.isArray(value)) return value.map(replaceSymbolsDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceSymbolsDeep(v);
    return out;
  }
  if (typeof value === 'string' && value.startsWith('$')) {
    const mapped = idMap.get(value);
    if (!mapped) throw new Error(`Unknown symbolic reference: ${value}`);
    return mapped;
  }
  return value;
}

async function main() {
  const tenant = {
    id: spec.tenant.id,
    name: spec.tenant.name || 'Generated Tenant',
    slug: spec.tenant.slug || `tenant-${spec.tenant.id.slice(0, 8)}`,
  };

  {
    const { error } = await supabase.from('tenants').upsert(tenant, { onConflict: 'id' });
    if (error) throw new Error(`Tenant upsert failed: ${error.message}`);
  }

  const objectRows = (spec.objectTypes || []).map((o) => ({
    id: idMap.get(o.symbolicId),
    tenant_id: tenant.id,
    display_name: o.displayName,
    config: replaceSymbolsDeep(o.config || {}),
  }));

  if (objectRows.length) {
    const { error } = await supabase.from('object_types').upsert(objectRows, { onConflict: 'id' });
    if (error) throw new Error(`Object types upsert failed: ${error.message}`);
  }

  const relationshipRows = (spec.relationships || []).map((r) => ({
    id: idMap.get(r.symbolicId),
    tenant_id: tenant.id,
    display_name: r.displayName,
    cardinality: r.cardinality,
    source_object_type_id: replaceSymbolsDeep(r.sourceObjectTypeId),
    target_object_type_id: replaceSymbolsDeep(r.targetObjectTypeId),
    source_display_name: r.sourceDisplayName,
    target_display_name: r.targetDisplayName,
    junction_object_type_id: r.junctionObjectTypeId ? replaceSymbolsDeep(r.junctionObjectTypeId) : null,
    source_fk_property_name: r.sourceFkPropertyName || null,
    target_fk_property_name: r.targetFkPropertyName || null,
    property_name: r.propertyName || null,
    config: replaceSymbolsDeep(r.config || {}),
  }));

  if (relationshipRows.length) {
    const { error } = await supabase.from('relationships').upsert(relationshipRows, { onConflict: 'id' });
    if (error) throw new Error(`Relationships upsert failed: ${error.message}`);
  }

  const actionRows = (spec.actions || []).map((a) => ({
    id: idMap.get(a.symbolicId),
    tenant_id: tenant.id,
    display_name: a.displayName,
    config: replaceSymbolsDeep(a.config || {}),
  }));

  if (actionRows.length) {
    const { error } = await supabase.from('action_types').upsert(actionRows, { onConflict: 'id' });
    if (error) throw new Error(`Actions upsert failed: ${error.message}`);
  }

  const processRows = (spec.processLayouts || []).map((p) => {
    const key = p.symbolicId || `$process:${p.processName}`;
    return {
      id: idMap.get(key),
      tenant_id: tenant.id,
      process_name: p.processName,
      object_type_ids: replaceSymbolsDeep(p.objectTypeIds || []),
      tracked_picklists: p.trackedPicklists || [],
      layout_data: replaceSymbolsDeep(p.layoutData || {}),
    };
  });

  if (processRows.length) {
    const { error } = await supabase.from('process_layouts').upsert(processRows, { onConflict: 'tenant_id,process_name' });
    if (error) throw new Error(`Process layouts upsert failed: ${error.message}`);
  }

  const [ot, rel, act, pl] = await Promise.all([
    supabase.from('object_types').select('id,display_name').eq('tenant_id', tenant.id).order('display_name', { ascending: true }),
    supabase.from('relationships').select('id,display_name,cardinality').eq('tenant_id', tenant.id).order('display_name', { ascending: true }),
    supabase.from('action_types').select('id,display_name').eq('tenant_id', tenant.id).order('display_name', { ascending: true }),
    supabase.from('process_layouts').select('id,process_name,tracked_picklists').eq('tenant_id', tenant.id).order('process_name', { ascending: true }),
  ]);

  if (ot.error || rel.error || act.error || pl.error) {
    throw new Error(`Verification read failed: ${ot.error?.message || rel.error?.message || act.error?.message || pl.error?.message}`);
  }

  console.log(JSON.stringify({
    tenant,
    counts: {
      object_types: ot.data.length,
      relationships: rel.data.length,
      action_types: act.data.length,
      process_layouts: pl.data.length,
    },
    object_types: ot.data,
    relationships: rel.data,
    action_types: act.data,
    process_layouts: pl.data,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
