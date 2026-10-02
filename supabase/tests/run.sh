#!/usr/bin/env bash
# Builds a throwaway Postgres database with a Supabase-like auth stub, applies the migrations
# (0002 twice + a 0001 re-run to prove idempotency) and runs the RLS tests.
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres bash supabase/tests/run.sh [dbname]
set -euo pipefail
DB="${1:-teams_test}"
cd "$(dirname "$0")/../.."
dropdb --if-exists "$DB"
createdb "$DB"
P=(psql -d "$DB" -v ON_ERROR_STOP=1 -q -X)
export PGOPTIONS="-c client_min_messages=warning"  # hide "already exists, skipping" notices, keep errors
"${P[@]}" -f supabase/tests/auth_stub.sql >/dev/null
for f in 0001_init 0002_teams 0002_teams 0001_init 0002_teams 0003_gto_terms 0003_gto_terms; do
  "${P[@]}" -f "supabase/migrations/$f.sql" >/dev/null
done
echo "migrations applied (0001, 0002, 0002, 0001, 0002, 0003, 0003)"
unset PGOPTIONS
"${P[@]}" -f supabase/tests/rls_test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
