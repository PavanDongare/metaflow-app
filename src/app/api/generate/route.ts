import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { exportConfig } from '@/app/lib/queries/export';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { prompt, tenantId, configName, isNew } = await req.json();

  if (!prompt || !tenantId || !configName) {
    return new Response('Missing required fields', { status: 400 });
  }

  const CONFIG_DIR = path.join(process.cwd(), 'examples/metaflow');
  const filename = configName + '.json';
  const configPath = path.join(CONFIG_DIR, filename);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function push(text: string) {
        controller.enqueue(encoder.encode(text));
      }

      try {
        if (!fs.existsSync(CONFIG_DIR)) {
          fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }

        if (isNew) {
          push('🆕 Creating new project blueprint: ' + configName + '...\n');
          if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
          }
        } else {
          push('🚀 Initializing Architect for update on: ' + configName + '...\n');
          const currentConfig = await exportConfig(tenantId);
          fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
        }

        // 2. Run Generation
        const outArg = 'examples/metaflow/' + filename;
        const genArgs = ['tools/metaflow-generator/generate.mjs', prompt, outArg];
        const gen = spawn('node', genArgs);

        gen.stdout.on('data', (data) => push(data.toString()));
        gen.stderr.on('data', (data) => push(data.toString()));

        const genExitCode = await new Promise((resolve) => {
          gen.on('close', resolve);
        });

        if (genExitCode !== 0) {
          push('\n❌ Generation failed with exit code ' + genExitCode + '\n');
          controller.close();
          return;
        }

        push('\n📦 Applying changes to Supabase...\n');

        // 3. Run Apply
        const applyArgs = ['tools/metaflow-generator/apply-json-to-supabase.mjs', outArg];
        const apply = spawn('node', applyArgs);

        apply.stdout.on('data', (data) => push(data.toString()));
        apply.stderr.on('data', (data) => push(data.toString()));

        const applyExitCode = await new Promise((resolve) => {
          apply.on('close', resolve);
        });

        if (applyExitCode === 0) {
          const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          push('\n✅ CONFIG_JSON_START\n' + JSON.stringify(updatedConfig) + '\nCONFIG_JSON_END\n');
          push('\n✨ Successfully synced ' + configName + ' to database.\n');
        } else {
          push('\n❌ Application failed with exit code ' + applyExitCode + '\n');
        }
      } catch (err: any) {
        push('\n🚨 Error: ' + err.message + '\n');
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
