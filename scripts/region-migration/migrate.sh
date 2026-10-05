#!/usr/bin/env bash
# Supabase region migration: Tokyo (ckzrvjisesooqcmmtvwl) -> Frankfurt (vwshzvxsitiwyayawcvr).
# Reads OLD_DB_URL / NEW_DB_URL (session pooler strings) from .env.migration.
#
#   migrate.sh dump     read-only dump of the old database into .migration-dumps/
#   migrate.sh schema   create extensions, public schema, auth trigger, storage policies on NEW (once)
#   migrate.sh data     wipe app + auth data on NEW, then load the latest dump (re-runnable)
#   migrate.sh rewrite  point stored URLs at the new project
#   migrate.sh verify   compare row counts OLD vs NEW
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="/c/Program Files/PostgreSQL/17/bin"
DUMPS="$ROOT/.migration-dumps"
OLD_REF=ckzrvjisesooqcmmtvwl
NEW_REF=vwshzvxsitiwyayawcvr
AUTH_TABLES=(auth.users auth.identities auth.mfa_factors)

set -a; . "$ROOT/.env.migration"; set +a
mkdir -p "$DUMPS"

psql_old() { "$PGBIN/psql" "$OLD_DB_URL" -v ON_ERROR_STOP=1 -X -q "$@"; }
psql_new() { "$PGBIN/psql" "$NEW_DB_URL" -v ON_ERROR_STOP=1 -X -q "$@"; }

cmd_dump() {
  echo "-> public schema"
  "$PGBIN/pg_dump" "$OLD_DB_URL" --schema=public --schema-only --no-owner \
    --no-comments -f "$DUMPS/schema.sql"

  echo "-> auth trigger + storage policies"
  psql_old -At -f "$ROOT/scripts/region-migration/extras.sql" > "$DUMPS/extras.sql"

  # pg_dump ignores --schema when --table is given, so public and auth are dumped separately.
  echo "-> data: public"
  "$PGBIN/pg_dump" "$OLD_DB_URL" --data-only --no-owner --schema=public -f "$DUMPS/data-public.sql"

  echo "-> data: auth users/identities"
  local auth_args=()
  for t in "${AUTH_TABLES[@]}"; do auth_args+=(--table="$t"); done
  "$PGBIN/pg_dump" "$OLD_DB_URL" --data-only --no-owner "${auth_args[@]}" -f "$DUMPS/data-auth.sql"

  # public already exists on NEW; supabase_admin default privileges are not ours to set.
  sed -i -E '/^CREATE SCHEMA public;$/d; /^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin /d' "$DUMPS/schema.sql"
  rm -f "$DUMPS/data.sql"

  ls -la "$DUMPS"
}

cmd_schema() {
  psql_new -c "create extension if not exists pg_trgm with schema public;"
  psql_new -f "$DUMPS/schema.sql"
  psql_new -f "$DUMPS/extras.sql"
  echo "schema applied"
}

cmd_data() {
  # Wipe NEW (only app tables + copied auth tables), then reload with triggers/FKs off
  # so on_auth_user_created does not fire for imported users.
  psql_new <<SQL
set session_replication_role = replica;
do \$\$ declare r record; begin
  for r in select schemaname, tablename from pg_tables where schemaname = 'public' loop
    execute format('truncate table %I.%I cascade', r.schemaname, r.tablename);
  end loop;
end \$\$;
truncate table auth.identities, auth.mfa_factors, auth.sessions, auth.refresh_tokens, auth.one_time_tokens cascade;
delete from auth.users;
SQL
  { echo "set session_replication_role = replica;"; cat "$DUMPS/data-auth.sql" "$DUMPS/data-public.sql"; } | psql_new
  echo "data loaded"
}

cmd_rewrite() {
  psql_new <<SQL
do \$\$ declare r record; n bigint; begin
  for r in
    select table_schema s, table_name t, column_name c, data_type dt
    from information_schema.columns join information_schema.tables using (table_schema, table_name)
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and data_type in ('text', 'character varying', 'jsonb')
  loop
    if r.dt = 'jsonb' then
      execute format('update %I.%I set %I = replace(%I::text, %L, %L)::jsonb where %I::text like %L',
        r.s, r.t, r.c, r.c, '$OLD_REF', '$NEW_REF', r.c, '%$OLD_REF%');
    else
      execute format('update %I.%I set %I = replace(%I, %L, %L) where %I like %L',
        r.s, r.t, r.c, r.c, '$OLD_REF', '$NEW_REF', r.c, '%$OLD_REF%');
    end if;
    get diagnostics n = row_count;
    if n > 0 then raise notice '%.%: % rows', r.t, r.c, n; end if;
  end loop;
end \$\$;
SQL
}

counts_sql="select string_agg(format('select %L t, count(*) n from %I.%I', schemaname||'.'||tablename, schemaname, tablename), ' union all ' order by schemaname, tablename)
  from pg_tables where schemaname = 'public' or (schemaname||'.'||tablename) in ($(printf "'%s'," "${AUTH_TABLES[@]}" | sed 's/,$//'))"

cmd_verify() {
  local q_old q_new
  q_old=$(psql_old -At -c "$counts_sql")
  q_new=$(psql_new -At -c "$counts_sql")
  diff <(psql_old -At -F' ' -c "$q_old order by 1") <(psql_new -At -F' ' -c "$q_new order by 1") \
    && echo "ALL ROW COUNTS MATCH" || echo "^ differences (< old, > new)"
  echo "old-ref leftovers in NEW:"
  psql_new -At -c "select count(*) from public.paint_catalog where swatch_image_url like '%$OLD_REF%'"
}

"cmd_${1:?usage: migrate.sh dump|schema|data|rewrite|verify}"
