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
"${P[@]}" -f supabase/tests/auth_stub.sql >/dev/null 2>&1
"${P[@]}" -f supabase/migrations/0001_init.sql >/dev/null 2>&1
"${P[@]}" -f supabase/migrations/0002_teams.sql >/dev/null 2>&1
"${P[@]}" -f supabase/migrations/0002_teams.sql >/dev/null 2>&1
"${P[@]}" -f supabase/migrations/0001_init.sql >/dev/null 2>&1
"${P[@]}" -f supabase/migrations/0002_teams.sql >/dev/null 2>&1
echo "migrations applied (0001, 0002, 0002, 0001, 0002)"
"${P[@]}" -f supabase/tests/rls_test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
