import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

// Note: Using service role key would be better for DDL, but we'll try with what we have
// or use a direct SQL approach if possible.
// Since we don't have the service role key, and anon key won't have DDL permissions,
// I will check if there's a migration tool or if I should ask the user.
// WAIT: The user has 'supabase' CLI available in package.json devDeps? No.
// But they have 'npx supabase'.

console.log('Attempting to sync schema with process_flag columns...');

const supabase = createClient(url, key);

async function main() {
  // If we can't run DDL via API (which is normal), we might need to tell the user.
  // But let's check if there's any other way.
  console.log('Please run the following SQL in your Supabase SQL Editor to sync the schema:');
  console.log(`
ALTER TABLE metaflow.object_types ADD COLUMN IF NOT EXISTS process_flag TEXT;
ALTER TABLE metaflow.relationships ADD COLUMN IF NOT EXISTS process_flag TEXT;
ALTER TABLE metaflow.action_types ADD COLUMN IF NOT EXISTS process_flag TEXT;
ALTER TABLE metaflow.process_layouts ADD COLUMN IF NOT EXISTS process_flag TEXT;
  `);
}

main().catch(console.error);
