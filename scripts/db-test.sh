#!/usr/bin/env bash
# Runs the database migrations, seed and pgTAP tests against a throwaway local Postgres.
# Needs PostgreSQL 16 with PostGIS and pgTAP (Ubuntu: postgresql-16-postgis-3 postgresql-16-pgtap pgtap).
# With Docker, `supabase start && supabase test db` runs the same tests against real Supabase.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PORT="${PGTEST_PORT:-54399}"
WORK="$(mktemp -d)"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$WORK"
  RUN_AS=(runuser -u postgres --)
fi

cleanup() {
  "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/pg.log" \
  -o "-p $PORT -k $WORK -c listen_addresses=''" -w start >/dev/null

export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d postgres)

"${PSQL[@]}" -c "alter database postgres set search_path = \"\$user\", public, extensions"
"${PSQL[@]}" -f "$ROOT/scripts/db-test/shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

if [ "${SKIP_SEED:-0}" != "1" ] && [ -f "$ROOT/supabase/seed.sql" ]; then
  echo "seed: seed.sql"
  "${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
  for f in "$ROOT"/supabase/seeds/*.sql; do
    echo "seed: seeds/$(basename "$f")"
    "${PSQL[@]}" -f "$f"
  done
fi

pg_prove -d postgres --ext .sql -r "$ROOT/supabase/tests"
