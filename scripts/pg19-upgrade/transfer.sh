#!/bin/bash
# Copy all data from the old otohime database into a freshly initialised one
# (migrations/default/1795720325269_init/up.sql applied, no rows yet).
#
#   OLD_DB=postgresql://otohime:...@db16/otohime \
#   NEW_DB=postgresql://postgres@localhost/otohime \
#   ./transfer.sh
#
# * NEW_DB must be a superuser (session_replication_role needs it). OLD_DB only
#   needs to read every table: the owner (otohime) is enough.
# * OLD_DB is only ever read: every session sets default_transaction_read_only.
# * Rows are streamed with COPY (text format) and an explicit, name-matched column
#   list, so column order differences do not matter.
# * The load runs with session_replication_role = replica, so user triggers
#   (system_time_generated_always!) and FK triggers do NOT fire: start/"end"
#   timestamps are preserved. CHECK, NOT NULL and UNIQUE are still enforced.
#   FKs are checked afterwards by verify.sh.
# * Columns listed in DROPPED exist only on the old side and are not copied.
# * If anything fails, drop and recreate the new database and start again.
set -euo pipefail

: "${OLD_DB:?set OLD_DB}" "${NEW_DB:?set NEW_DB}"
[ "$OLD_DB" != "$NEW_DB" ] || { echo "OLD_DB and NEW_DB are the same" >&2; exit 1; }

# old table name -> new table name, for renamed tables
declare -A RENAMED_FROM=( [dx_intl_charts]=dx_intl_notes [finale_charts]=finale_notes )
# new table -> old table it is converted from, and the SELECT doing it (on the old
# side; output columns named like the new ones). The single dx_intl_constants row
# (threshold = current version - 1) becomes the current version's release row; the
# older releases come from seeds/default/1795720325269_versions.sql.
declare -A CONVERTED_FROM=( [dx_intl_versions]=dx_intl_constants )
declare -A CONVERTED_SELECT=(
  [dx_intl_versions]="SELECT current_version_threshold + 1 AS version, active_since AS released_at FROM public.dx_intl_constants"
)
# new table name -> old columns dropped on purpose (space separated): the surrogate
# ids that Hasura upserts used up on every import; the natural keys replace them
declare -A DROPPED=(
  [dx_intl_records]=id [dx_intl_records_history]=id
  [dx_intl_scores]=id [dx_intl_scores_history]=id
)

old() { psql "$OLD_DB" -X -q -v ON_ERROR_STOP=1 -tA -c "SET default_transaction_read_only = on" "$@"; }
new() { psql "$NEW_DB" -X -q -v ON_ERROR_STOP=1 -tA "$@"; }

cols() { # <db-func> <table>: column names in attnum order, one per line
  "$1" -c "SELECT attname FROM pg_attribute
           WHERE attrelid = 'public.$2'::regclass AND attnum > 0 AND NOT attisdropped
             AND attgenerated = ''
           ORDER BY attnum"
}

# Same server/database twice would be catastrophic: compare system identifiers too.
old_id=$(old -c "SELECT system_identifier || '/' || current_database() FROM pg_control_system()")
new_id=$(new -c "SELECT system_identifier || '/' || current_database() FROM pg_control_system()")
[ "$old_id" != "$new_id" ] || { echo "OLD_DB and NEW_DB point at the same database" >&2; exit 1; }

# Rows written to the old database during the copy would be lost: Hasura and hooks
# must be stopped. Set ALLOW_OLD_CLIENTS=1 only for a rehearsal on a scratch copy.
others=$(old -c "SELECT string_agg(DISTINCT coalesce(nullif(application_name, ''), usename::text, '?'), ', ')
                 FROM pg_stat_activity WHERE datname = current_database()
                   AND backend_type = 'client backend' AND pid <> pg_backend_pid()")
if [ -n "$others" ] && [ "${ALLOW_OLD_CLIENTS:-}" != 1 ]; then
  echo "other clients are connected to OLD_DB ($others): stop hasura and hooks first" >&2; exit 1
fi
# COPY text is passed through unconverted only when both sides are UTF8.
for side in old new; do
  enc=$("$side" -c "SHOW server_encoding")
  [ "$enc" = UTF8 ] || { echo "$side database encoding is $enc, expected UTF8" >&2; exit 1; }
done

mapfile -t NEW_TABLES < <(new -c "SELECT relname FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname")
mapfile -t OLD_TABLES < <(old -c "SELECT relname FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname")

# --- preflight -------------------------------------------------------------
fail=0
declare -A COVERED=()
for t in "${NEW_TABLES[@]}"; do
  if [ -n "${CONVERTED_FROM[$t]:-}" ]; then
    src=${CONVERTED_FROM[$t]}; COVERED[$src]=1
    n=$(new -c "SELECT count(*) FROM (SELECT 1 FROM public.$t LIMIT 1) x")
    [ "$n" = 0 ] || { echo "preflight: new table $t is not empty" >&2; fail=1; }
    collist=$(cols new "$t" | sed 's/.*/"&"/' | paste -sd, -)
    old -c "SELECT $collist FROM (${CONVERTED_SELECT[$t]}) converted LIMIT 0" >/dev/null \
      || { echo "preflight: cannot convert $src -> $t" >&2; fail=1; }
    continue
  fi
  src=${RENAMED_FROM[$t]:-$t}
  COVERED[$src]=1
  if ! printf '%s\n' "${OLD_TABLES[@]}" | grep -qxF "$src"; then
    echo "preflight: new table $t has no source table $src" >&2; fail=1; continue
  fi
  n=$(new -c "SELECT count(*) FROM (SELECT 1 FROM public.$t LIMIT 1) x")
  [ "$n" = 0 ] || { echo "preflight: new table $t is not empty" >&2; fail=1; }
  nc=$(cols new "$t" | sort); oc=$(cols old "$src" | sort)
  for c in ${DROPPED[$t]:-}; do
    # the allow-list must stay exact: the column exists on the old side only
    if ! grep -qxF "$c" <<<"$oc" || grep -qxF "$c" <<<"$nc"; then
      echo "preflight: DROPPED $t.$c is not an old-only column" >&2; fail=1
    fi
    oc=$(grep -vxF "$c" <<<"$oc")
  done
  if [ "$nc" != "$oc" ]; then
    echo "preflight: column mismatch $src -> $t:" >&2
    diff <(echo "$oc") <(echo "$nc") | sed 's/^/    /' >&2 || true
    fail=1
  fi
done
for t in "${OLD_TABLES[@]}"; do
  [ -n "${COVERED[$t]:-}" ] || { echo "preflight: old table $t has no destination" >&2; fail=1; }
done
[ "$fail" = 0 ] || { echo "preflight failed, nothing copied" >&2; exit 1; }
echo "preflight ok: ${#NEW_TABLES[@]} tables"
for t in "${!DROPPED[@]}"; do echo "  not copied: ${RENAMED_FROM[$t]:-$t}.{${DROPPED[$t]// /,}}"; done | sort
for t in "${!CONVERTED_FROM[@]}"; do echo "  converted: ${CONVERTED_FROM[$t]} -> $t"; done | sort

# --- copy ------------------------------------------------------------------
for t in "${NEW_TABLES[@]}"; do
  src="public.${RENAMED_FROM[$t]:-$t}"
  [ -z "${CONVERTED_SELECT[$t]:-}" ] || src="(${CONVERTED_SELECT[$t]}) converted"
  collist=$(cols new "$t" | sed 's/.*/"&"/' | paste -sd, -)
  start=$SECONDS
  old -c "COPY (SELECT $collist FROM $src) TO STDOUT" \
    | new -c "SET session_replication_role = replica" \
          -c "COPY public.$t ($collist) FROM STDIN"
  n=$(new -c "SELECT count(*) FROM public.$t")
  printf '  %-32s %10s rows  %4ss\n' "$t" "$n" $((SECONDS - start))
done

# --- sequences: never hand out an id the old database already used ----------
echo "sequences:"
while IFS='|' read -r t c seq; do
  [ -n "$t" ] || continue
  src=${RENAMED_FROM[$t]:-$t}
  old_seq=$(old -c "SELECT pg_get_serial_sequence('public.$src', '$c')")
  old_last=0
  if [ -n "$old_seq" ]; then
    old_last=$(old -c "SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END FROM $old_seq")
  fi
  val=$(new -c "SELECT greatest(coalesce(max(\"$c\"), 0), $old_last) FROM public.$t")
  if [ "$val" -gt 0 ]; then new -c "SELECT setval('$seq', $val, true)" >/dev/null
  else new -c "SELECT setval('$seq', 1, false)" >/dev/null; fi
  printf '  %-40s -> %s\n' "$seq" "$val"
done < <(new -c "SELECT c.relname, a.attname, pg_get_serial_sequence(c.oid::regclass::text, a.attname)
  FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
    AND pg_get_serial_sequence(c.oid::regclass::text, a.attname) IS NOT NULL
  ORDER BY 1, 2")

# --- materialized views and statistics --------------------------------------
echo "refreshing materialized views:"
for mv in $(new -c "SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'm' ORDER BY 1"); do
  new -c "REFRESH MATERIALIZED VIEW public.$mv"; echo "  $mv"
done
new -c "ANALYZE"
echo "transfer done; now run verify.sh"
