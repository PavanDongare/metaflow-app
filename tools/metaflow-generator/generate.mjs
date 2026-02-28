#!/usr/bin/env node

/**
 * MetaFlow Gemini Generator
 * This script is a wrapper around gemini-cli to generate configs.
 */

import { execSync } from 'node:child_process';

const prompt = process.argv[2];
const output = process.argv[3] || 'examples/metaflow/generated.json';

if (!prompt) {
  console.error('Usage: node tools/metaflow-generator/generate.mjs "Your business process description" [output_path]');
  process.exit(1);
}

const guidelinesPath = 'tools/metaflow-generator/METAFLOW_GUIDELINES.md';
const examplePath = 'examples/metaflow/deal-pipeline.canonical.export.json';

console.log(`🚀 Generating MetaFlow config for: "${prompt}"`);

// We use template literals but ensure we don't break the shell command
const geminiCommand = `gemini --yolo -p "Act as a MetaFlow Architect. Your task is to generate a JSON configuration for a new business process: '${prompt.replace(/"/g, '\\"')}' Guidelines: $(cat ${guidelinesPath}) IMPORTANT: Every object type, relationship, action, and process layout MUST include a 'processFlag' string property set to a logical process name like 'Sales' or 'Inventory'. Use this canonical example as your structural template: $(cat ${examplePath}) Output ONLY the final JSON object. Do not include markdown fences or prose. Write the result to ${output}. Then run: node tools/metaflow-generator/validate-config.mjs ${output} If validation fails, fix the JSON and repeat until valid."`;

try {
  execSync(geminiCommand, { stdio: 'inherit' });
  console.log(`\n✅ Generation complete: ${output}`);
} catch (err) {
  console.error('\n❌ Generation failed.');
  process.exit(1);
}
