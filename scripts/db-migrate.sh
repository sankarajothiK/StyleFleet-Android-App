#!/usr/bin/env bash
# Copy the StyleFleet database from the OLD Supabase project to the NEW one.
#
# Put the two connection strings in YOUR terminal only (never paste them in chat or commit them):
#   export OLD_DB_URL='postgresql://postgres:<password>@db.<old-ref>.supabase.co:5432/postgres'
#   export NEW_DB_URL='postgresql://postgres:<password>@db.<new-ref>.supabase.co:5432/postgres'
# Use the "Session pooler" string if the direct host does not resolve (IPv6 networks).
#
#   bash scripts/db-migrate.sh dump      # 1. read-only: writes ./migration-dump/
#   bash scripts/db-migrate.sh restore   # 2. writes into the NEW database
#   bash scripts/db-migrate.sh verify    # 3. prints reconcile output for both, to diff
set -euo pipefail
OUT=./migration-dump
mkdir -p "$OUT"

need() { [ -n "${!1:-}" ] || { echo "Set $1 first (see the comment at the top of this file)"; exit 1; }; }

case "${1:-}" in
  dump)
    need OLD_DB_URL
    # public schema only: tables, functions, policies, indexes. No owners or grants (the new project has its own).
    pg_dump "$OLD_DB_URL" --schema=public --schema-only --no-owner --no-privileges -f "$OUT/01_schema.sql"
    # all rows. COPY format, triggers off so foreign keys do not fight the load order.
    pg_dump "$OLD_DB_URL" --schema=public --data-only --no-owner --disable-triggers -f "$OUT/02_data.sql"
    echo "Dumped to $OUT. Review 01_schema.sql before restoring."
    ;;
  restore)
    need NEW_DB_URL
    echo "This writes into the NEW database. Press Enter to continue, Ctrl+C to stop."; read -r _
    psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$OUT/01_schema.sql"
    psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$OUT/02_data.sql"
    echo "Restored. Now run: bash scripts/db-migrate.sh verify"
    ;;
  verify)
    need OLD_DB_URL; need NEW_DB_URL
    psql "$OLD_DB_URL" -A -F ' | ' -f supabase/reconcile_counts.sql > "$OUT/old_counts.txt"
    psql "$NEW_DB_URL" -A -F ' | ' -f supabase/reconcile_counts.sql > "$OUT/new_counts.txt"
    if diff -u "$OUT/old_counts.txt" "$OUT/new_counts.txt"; then echo "MATCH: counts and money totals are identical."; else echo "DIFFERENT: see above."; exit 1; fi
    ;;
  *) sed -n 2,13p "$0" ;;
esac
