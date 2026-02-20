# MetaFlow JSON -> SQL (CLI-first)

## Generate SQL

```bash
node tools/metaflow-generator/convert-json-to-sql.mjs \
  examples/metaflow/deal-pipeline.sample.json \
  examples/metaflow/deal-pipeline.sample.sql
```

## Run the SQL

Run `examples/metaflow/deal-pipeline.sample.sql` in your Supabase SQL editor (or psql against the same DB).

## Closed Loop (Cloud DB apply)

```bash
npm run metaflow:demo:loop
```

This runs:
1. Prepare `examples/metaflow/deal-pipeline.demo.json` for demo tenant.
2. Generate SQL at `examples/metaflow/deal-pipeline.demo.sql`.
3. Apply the same resolved config into Supabase via API writes in dependency order.
4. Print verification summary counts and IDs.

## Export Current DB Config -> JSON

```bash
npm run metaflow:default:export
```

This exports the current `Deal Pipeline` config from default tenant into:
- `examples/metaflow/deal-pipeline.default.export.json`

You can then generate SQL from the exported snapshot:

```bash
node tools/metaflow-generator/convert-json-to-sql.mjs \
  examples/metaflow/deal-pipeline.default.export.json \
  examples/metaflow/deal-pipeline.default.export.sql
```

## Agentic Loop (Prompt -> JSON -> SQL -> Optional DB)

Run iterative generation with operation-level updates and validation:

```bash
npm run metaflow:agent -- \
  --prompt "Build a loan origination pipeline with applicant, loan, and broker link metadata" \
  --provider openrouter \
  --model qwen/qwen3-coder:free \
  --tenant-id 00000000-0000-0000-0000-000000000001 \
  --tenant-name "Default Tenant" \
  --tenant-slug default \
  --output examples/metaflow/generated.agent.json \
  --sql-out examples/metaflow/generated.agent.sql
```

Notes:
- `openrouter` is the default provider.
- Set `OPENROUTER_API_KEY` for OpenRouter usage.
- Free-only enforcement is built in:
  model id must end with `:free` and pricing is verified as `0/0` before loop starts.
- Recommended free coding model: `qwen/qwen3-coder:free`.
- Random free pool is also supported via `--model openrouter/free` (less stable/less predictable).

To apply after generation:

```bash
npm run metaflow:agent -- \
  --prompt "..." \
  --provider openrouter \
  --model qwen/qwen3-coder:free \
  --output examples/metaflow/generated.agent.json \
  --sql-out examples/metaflow/generated.agent.sql \
  --apply
```

## Verify

Run `examples/metaflow/deal-pipeline.verify.sql` and confirm counts are non-zero for your tenant.
