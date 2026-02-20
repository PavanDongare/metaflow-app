#!/usr/bin/env node

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const samplePath = 'examples/metaflow/deal-pipeline.sample.json';
const demoPath = 'examples/metaflow/deal-pipeline.demo.json';
const demoSqlPath = 'examples/metaflow/deal-pipeline.demo.sql';

const spec = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
spec.tenant = {
  id: '00000000-0000-0000-0000-000000000025',
  name: 'Demo Tenant',
  slug: 'demo',
};

fs.writeFileSync(demoPath, JSON.stringify(spec, null, 2));
console.log(`Prepared ${demoPath}`);

execSync(`node tools/metaflow-generator/convert-json-to-sql.mjs ${demoPath} ${demoSqlPath}`, { stdio: 'inherit' });
execSync(`node tools/metaflow-generator/apply-json-to-supabase.mjs ${demoPath}`, { stdio: 'inherit' });

console.log('\nClosed loop complete.');
console.log(`SQL artifact: ${demoSqlPath}`);
