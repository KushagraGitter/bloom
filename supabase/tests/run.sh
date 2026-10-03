#!/usr/bin/env bash
# Applies the migrations to a throwaway Postgres database and runs the RLS checks.
#
# Usage: supabase/tests/run.sh
# Needs psql and a Postgres server you can create databases on
# (set PGHOST/PGUSER/etc. as usual). The database is dropped afterwards.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
db="bloom_rls_test_$$"

createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT

psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$here/stub_supabase.sql"
for f in "$here"/../migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$f"
done
psql -v ON_ERROR_STOP=1 -q -o /dev/null -d "$db" -f "$here/rls_test.sql"
