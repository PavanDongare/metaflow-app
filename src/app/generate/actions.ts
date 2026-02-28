'use server';

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { exportConfig } from '../lib/queries/export';

const CONFIG_DIR = path.join(process.cwd(), 'examples/metaflow');

export async function listConfigs() {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  return fs.readdirSync(CONFIG_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

export async function getConfig(name: string) {
  const filePath = path.join(CONFIG_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export async function runGenerate(prompt: string, tenantId: string, configName: string) {
  try {
    const filename = `${configName}.json`;
    const configPath = path.join(CONFIG_DIR, filename);
    
    // Ensure directory exists
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

    // 1. If editing existing, we don't necessarily need to export from DB 
    // because the JSON is our Source of Truth for the "Architect".
    // But we ensure the file exists. If it's "new", generate.mjs will handle it.

    // 2. Run the generator script
    const gen = spawnSync('node', [
      'tools/metaflow-generator/generate.mjs',
      prompt,
      `examples/metaflow/${filename}`
    ], {
      env: { ...process.env, PATH: process.env.PATH },
      encoding: 'utf-8'
    });

    const output = gen.stdout + gen.stderr;
    
    if (gen.status !== 0) {
      throw new Error(`Generation failed: ${output}`);
    }

    // 3. Read the updated JSON
    const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // 4. Apply it to Supabase
    const apply = spawnSync('node', [
      'tools/metaflow-generator/apply-json-to-supabase.mjs',
      `examples/metaflow/${filename}`
    ], {
      env: { ...process.env, PATH: process.env.PATH },
      encoding: 'utf-8'
    });

    const applyOutput = apply.stdout + apply.stderr;

    return {
      success: apply.status === 0,
      log: output + '\n\n--- APPLY LOG ---\n\n' + applyOutput,
      config: updatedConfig,
      configName: configName
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}
