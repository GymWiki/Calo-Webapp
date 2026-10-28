#!/usr/bin/env bash
# Lokale RLS-test voor de eigenaar-/adminmodus: start een tijdelijke Postgres (alleen lokaal, nooit productie), bouwt de stub
# (supabase/tests/admin_rls_stub.sql), past de migratie twee keer toe (idempotent) en draait supabase/tests/admin_rls_test.sql.
# Vereist de PostgreSQL-binaries (PG_BIN of /usr/lib/postgresql/<versie>/bin) en psql.
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$BIN/initdb" ] || { echo "PostgreSQL-binaries niet gevonden (zet PG_BIN)."; exit 2; }
DIR="$(mktemp -d /tmp/gymwiki-rls-XXXXXX)"
PORT="${PG_TEST_PORT:-54329}"
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$DIR" && chmod 755 "$DIR" && chmod 644 supabase/migrations/*.sql
cleanup() { as_pg "$BIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null 2>&1 || true"; rm -rf "$DIR"; }
trap cleanup EXIT
as_pg "$BIN/initdb -D $DIR/data -A trust -U postgres >/dev/null"
as_pg "$BIN/pg_ctl -D $DIR/data -o \"-p $PORT -k $DIR -c listen_addresses=''\" -w start >/dev/null"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$DIR" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f supabase/tests/admin_rls_stub.sql
"${PSQL[@]}" -f supabase/migrations/admin_roles_audit.sql
"${PSQL[@]}" -f supabase/migrations/admin_roles_audit.sql   # idempotent
"${PSQL[@]}" -f supabase/migrations/floorplans_curated_by_admin.sql
"${PSQL[@]}" -f supabase/migrations/floorplans_curated_by_admin.sql   # idempotent
set +e
OUT="$("${PSQL[@]}" -f supabase/tests/admin_rls_test.sql 2>&1)"
STATUS=$?
set -e
echo "$OUT" | sed -E 's/^psql:[^ ]+ NOTICE:  //' | grep -E "^ok -|ALLE RLS|TEST MISLUKT|ERROR|CONTEXT" || true
exit $STATUS
