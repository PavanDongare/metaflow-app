#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prompt = process.argv[2];
const output = process.argv[3];

if (!prompt || !output) {
  console.error('Usage: generate.mjs <prompt> <output_path>');
  process.exit(1);
}

const guidelinesPath = path.join(__dirname, 'METAFLOW_GUIDELINES.md');
const examplePath = path.join(__dirname, '../../examples/metaflow/deal-pipeline.canonical.export.json');

let currentState = '';
if (fs.existsSync(output)) {
  const content = fs.readFileSync(output, 'utf8');
  if (content.length > 50) {
    currentState = 'CURRENT_STATE: ' + content;
  }
}

const guidelines = fs.readFileSync(guidelinesPath, 'utf8');
const example = fs.readFileSync(examplePath, 'utf8');

const masterPrompt = `Act as a MetaFlow Architect. Your task is to ${currentState ? 'update the existing' : 'generate a new'} JSON configuration for a business process: '${prompt.replace(/"/g, "'")}' ${currentState ? 'Ensure you preserve existing symbolic IDs and only modify or add what is requested.' : ''} Guidelines: ${guidelines} IMPORTANT: Every object type, relationship, action, and process layout MUST include a 'processFlag' string property set to a logical process name like 'Sales' or 'Inventory'. Use this canonical example as your structural template: ${example} ${currentState} Output ONLY the final JSON object. Do not include markdown fences or prose.`;

console.log('🚀 Architecting with Gemini...');

const gemini = spawn('gemini', ['--yolo', '-p', masterPrompt]);

let fullResult = '';

gemini.stdout.on('data', (data) => {
  const chunk = data.toString();
  fullResult += chunk;
  process.stdout.write(chunk); // Stream to terminal
});

gemini.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

gemini.on('close', (code) => {
  if (code === 0) {
    // Clean up any markdown fences if Gemini ignored the instruction
    const cleanResult = fullResult.replace(/```json\n?/, '').replace(/```\n?/, '').trim();
    fs.writeFileSync(output, cleanResult);
    console.log('\n✅ Generation complete');
    
    // Validate
    const validate = spawn('node', ['tools/metaflow-generator/validate-config.mjs', output], { stdio: 'inherit' });
    validate.on('close', (vCode) => {
      process.exit(vCode);
    });
  } else {
    console.error(`\n❌ Generation failed with code ${code}`);
    process.exit(code);
  }
});
