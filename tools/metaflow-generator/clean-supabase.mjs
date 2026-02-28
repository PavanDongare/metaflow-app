import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { db: { schema: 'metaflow' } });

async function main() {
  console.log('Connecting to Supabase to clean up MetaFlow data...');

  // The tenant ID used in the examples/demo
  const tenantId = '00000000-0000-0000-0000-000000000001';

  const tables = [
    'action_log',
    'objects',
    'project_snapshots',
    'process_layouts',
    'action_types',
    'relationships',
    'object_types'
  ];

  for (const table of tables) {
    console.log(`Cleaning up ${table}...`);
    const { error } = await supabase.from(table).delete().eq('tenant_id', tenantId);
    if (error) {
      console.error(`Error deleting from ${table}:`, error.message);
    } else {
      console.log(`Successfully cleaned ${table}.`);
    }
  }
  
  console.log('Finished cleaning Supabase.');
}

main().catch(console.error);
