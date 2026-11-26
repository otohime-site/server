#!/bin/bash
# Verify a transfer.sh run. Read-only on both databases.
#
#   OLD_DB=... NEW_DB=... ./verify.sh
#
# Checks:
#   1. every table: same row count and same content hash (name-matched columns)
#   2. every plain view: same content hash (live views must agree exactly)
#   3. every FK in the new database has no orphans (the load skipped FK triggers)
#   4. every serial sequence is ahead of max(id)
#   5. system-versioning and history-removal triggers are present and enabled
#   6. materialized views: content hash (WARN only: the old ones may be stale)
# Exit code 0 = all hard checks passed.
set -euo pipefail

: "${OLD_DB:?set OLD_DB}" "${NEW_DB:?set NEW_DB}"
declare -A RENAMED_FROM=( [dx_intl_charts]=dx_intl_notes [finale_charts]=finale_notes )
# same conversion as transfer.sh; the seed may add older versions to the new side
declare -A CONVERTED_SELECT=(
  [dx_intl_versions]="SELECT current_version_threshold + 1 AS version, active_since AS released_at FROM public.dx_intl_constants"
)
declare -A CONVERTED_NEW_WHERE=(
  [dx_intl_versions]="version = (SELECT max(version) FROM public.dx_intl_versions WHERE released_at <= now())"
)

SETUP=(-c "SET default_transaction_read_only = on" -c "SET TimeZone = 'UTC'" -c "SET DateStyle = 'ISO, MDY'")
old() { psql "$OLD_DB" -X -q -v ON_ERROR_STOP=1 -tA "${SETUP[@]}" "$@"; }
new() { psql "$NEW_DB" -X -q -v ON_ERROR_STOP=1 -tA "${SETUP[@]}" "$@"; }

rels() { new -c "SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = '$1' ORDER BY 1"; }
collist() {
  new -c "SELECT string_agg(quote_ident(attname), ',' ORDER BY attnum) FROM pg_attribute
          WHERE attrelid = 'public.$1'::regclass AND attnum > 0 AND NOT attisdropped"
}
digest() { # <db-func> <relation> <collist>: "<rows> <hash>"
  # Row hashes are combined in 256 buckets (by their first two hex digits): one
  # string_agg over every row would hit the 1 GB value limit at ~30M rows.
  "$1" -c "SELECT coalesce(sum(n), 0) || ' ' || coalesce(md5(string_agg(b, '' ORDER BY k)), '-')
           FROM (SELECT left(h, 2) k, count(*) n, md5(string_agg(h, '' ORDER BY h)) b
                 FROM (SELECT md5(ROW($3)::text) h FROM $2) x GROUP BY 1) y"
}

fail=0
compare() { # <kind> <new-rel> <hard:1|0>
  local t=$2 src="public.${RENAMED_FROM[$2]:-$2}" dst="public.$2" cl o n
  if [ -n "${CONVERTED_SELECT[$t]:-}" ]; then
    src="(${CONVERTED_SELECT[$t]}) converted"
    dst="(SELECT * FROM public.$t WHERE ${CONVERTED_NEW_WHERE[$t]}) converted"
  fi
  cl=$(collist "$t")
  o=$(digest old "$src" "$cl" 2>&1) || o="ERROR: $o"
  n=$(digest new "$dst" "$cl" 2>&1) || n="ERROR: $n"
  if [ "$o" = "$n" ]; then printf '  ok    %-6s %-34s %s\n' "$1" "$t" "${n%% *} rows"
  elif [ "$3" = 1 ]; then printf '  FAIL  %-6s %-34s old=%s new=%s\n' "$1" "$t" "$o" "$n"; fail=1
  else printf '  WARN  %-6s %-34s old=%s new=%s\n' "$1" "$t" "$o" "$n"; fi
}

echo "1. tables"
for t in $(rels r); do compare table "$t" 1; done

echo "2. views"
for v in $(rels v); do compare view "$v" 1; done

echo "3. foreign keys (orphans in new database)"
while IFS='|' read -r con q; do
  [ -n "$con" ] || continue
  n=$(new -c "$q")
  if [ "$n" = 0 ]; then echo "  ok    $con"; else echo "  FAIL  $con: $n orphan rows"; fail=1; fi
done < <(new -c "
  SELECT c.conname,
         format('SELECT count(*) FROM %s ch WHERE %s AND NOT EXISTS (SELECT 1 FROM %s pa WHERE %s)',
           c.conrelid::regclass, string_agg(format('ch.%I IS NOT NULL', ca.attname), ' AND '),
           c.confrelid::regclass, string_agg(format('pa.%I = ch.%I', pa.attname, ca.attname), ' AND '))
  FROM pg_constraint c
  CROSS JOIN LATERAL unnest(c.conkey, c.confkey) AS k(ck, pk)
  JOIN pg_attribute ca ON ca.attrelid = c.conrelid AND ca.attnum = k.ck
  JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = k.pk
  WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
  GROUP BY c.oid, c.conname, c.conrelid, c.confrelid ORDER BY 1")

echo "4. sequences"
while IFS='|' read -r t c seq; do
  [ -n "$t" ] || continue
  r=$(new -c "SELECT (SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END FROM $seq)
                     >= coalesce(max(\"$c\"), 0) FROM public.$t")
  if [ "$r" = t ]; then echo "  ok    $seq"; else echo "  FAIL  $seq is behind max($t.$c)"; fail=1; fi
done < <(new -c "SELECT c.relname, a.attname, pg_get_serial_sequence(c.oid::regclass::text, a.attname)
  FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
    AND pg_get_serial_sequence(c.oid::regclass::text, a.attname) IS NOT NULL ORDER BY 1, 2")

echo "5. triggers"
expected="dx_intl_players_purge_history
dx_intl_records_check_changed
dx_intl_records_history_require_deleted_player
dx_intl_records_system_time_generated_always
dx_intl_records_system_time_write_history
dx_intl_records_truncate
dx_intl_scores_check_changed
dx_intl_scores_history_require_deleted_player
dx_intl_scores_require_dx_score
dx_intl_scores_system_time_generated_always
dx_intl_scores_system_time_write_history
dx_intl_scores_truncate"
actual=$(new -c "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgenabled = 'O'
                 AND tgrelid IN ('public.dx_intl_players'::regclass,
                                 'public.dx_intl_records'::regclass, 'public.dx_intl_records_history'::regclass,
                                 'public.dx_intl_scores'::regclass, 'public.dx_intl_scores_history'::regclass) ORDER BY 1")
if [ "$actual" = "$expected" ]; then echo "  ok    12 triggers enabled"
else echo "  FAIL  triggers differ:"; diff <(echo "$expected") <(echo "$actual") | sed 's/^/        /'; fail=1; fi

echo "6. materialized views (warn only)"
for m in $(rels m); do compare matv "$m" 0; done

if [ "$fail" = 0 ]; then echo "ALL CHECKS PASSED"; else echo "CHECKS FAILED"; exit 1; fi
