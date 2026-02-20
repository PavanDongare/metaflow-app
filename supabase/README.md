# Supabase Database Setup

This project uses **declarative schemas** as the source of truth for database structure.

## Directory Structure

```
supabase/
├── config.toml          # Supabase configuration (has schema_paths)
├── reset-db.sh          # Bootstrap script for fresh databases
└── schemas/
    ├── 01_dms/          # Document Management System
    ├── 02_onenote/      # Notes app
    └── 03_metaflow/     # Ontology platform
```

## First-Time Setup

```bash
supabase start
./supabase/reset-db.sh
```

## Day-to-Day Workflow

```bash
# 1. Edit schema file
vim supabase/schemas/03_metaflow/02_tables.sql

# 2. Apply changes (diffs and generates ALTERs automatically)
supabase db push
```

That's it. `supabase db push` handles everything:
- Compares schema files vs database
- Auto-generates ALTER statements
- Applies changes safely

## Command Reference

| Action | Command |
|--------|---------|
| Start Supabase | `supabase start` |
| Stop Supabase | `supabase stop` |
| **Apply schema changes** | `supabase db push` |
| Preview changes | `supabase db diff` |
| Fresh setup (schemas missing) | `./supabase/reset-db.sh` |
| Interactive psql | `docker exec -it supabase_db_platform psql -U postgres` |

## Troubleshooting

**PGRST002 error ("Could not query schema cache")**
- Schemas don't exist in database
- Run: `./supabase/reset-db.sh`
- Then: `docker restart supabase_rest_platform`

**Schema changes not applying**
- Don't use `reset-db.sh` for changes (it only creates, can't modify)
- Use: `supabase db push`

## Official Docs

- [Declarative Schemas](https://supabase.com/docs/guides/local-development/declarative-database-schemas)
- [Local Development](https://supabase.com/docs/guides/local-development)
