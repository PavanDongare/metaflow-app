#!/bin/bash
# =============================================================================
# Reset Database from Declarative Schemas
# =============================================================================
#
# IMPORTANT: For most schema changes, use `supabase db push` instead!
#
# =============================================================================
# WHICH COMMAND TO USE?
# =============================================================================
#
#   supabase db push     (RECOMMENDED - use this for day-to-day development)
#     - Diffs your schema files against the database
#     - Auto-generates and applies ALTER statements
#     - Handles column adds/changes/removals
#     - Safe for databases with existing data
#     - Works because config.toml has schema_paths configured
#
#   ./supabase/reset-db.sh  (this script - rarely needed)
#     - Only runs CREATE IF NOT EXISTS statements
#     - Cannot modify existing tables (won't add new columns)
#     - Use only when schemas don't exist at all
#
# =============================================================================
# WHEN TO USE THIS SCRIPT:
# =============================================================================
#   - Fresh clone of the repo (first-time setup)
#   - After `supabase stop && supabase start` if schemas are missing
#   - PostgREST showing PGRST002 errors (schemas don't exist)
#
# WHEN NOT TO USE:
#   - You changed a schema file and want to apply it → use `supabase db push`
#   - You added a column to an existing table → use `supabase db push`
#   - Any modification to existing structures → use `supabase db push`
#
# =============================================================================
# USAGE:
#   ./supabase/reset-db.sh
#
# PREREQUISITES:
#   - Supabase must be running: `supabase start`
#   - Docker must be running
#
# =============================================================================

set -e
cd "$(dirname "$0")"

echo "Resetting database from declarative schemas..."
echo ""

# Apply each schema in order
for schema_dir in schemas/00_core schemas/01_dms schemas/02_onenote schemas/03_metaflow; do
  for sql_file in "$schema_dir"/*.sql; do
    if [ -f "$sql_file" ]; then
      echo "  Applying: $sql_file"
      docker exec -i supabase_db_platform psql -U postgres < "$sql_file"
    fi
  done
done

echo ""
echo "Done! All schemas applied."
echo ""
echo "If you see permission errors, restart supabase:"
echo "  supabase stop && supabase start"
