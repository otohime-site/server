#!/bin/bash
# Compare the structure of the old and new public schema, ignoring object NAMES
# (constraints, indexes, sequences were renamed on purpose) but not definitions.
# Read-only on both databases. Intentional structural changes (beyond renames) are
# listed in schema-compare.expected as "- old line" / "+ new line"; the actual
# difference must match that list exactly. Exit 0 = identical apart from that list.
#
#   OLD_DB=... NEW_DB=... ./schema-compare.sh
set -euo pipefail
: "${OLD_DB:?set OLD_DB}" "${NEW_DB:?set NEW_DB}"

# applied to the OLD side's output so renamed tables line up
RENAME_SED='s/\bdx_intl_notes\b/dx_intl_charts/g; s/\bfinale_notes\b/finale_charts/g'
# an explicit owner-has-everything ACL (pre-17 "arwdDxt", 17+ adds "m") equals the default
ACL_SED='s#^acl ([a-z_0-9]+) ([a-z_0-9]+)=arwdDxtm?/\2$#acl \1 <default>#'

Q=$(cat <<'SQL'
SET default_transaction_read_only = on;
-- relations and their columns
SELECT 'col ' || c.relkind::text || ' ' || c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
       || CASE WHEN a.attnotnull THEN ' not null' ELSE '' END
       || coalesce(' default ' || regexp_replace(pg_get_expr(d.adbin, d.adrelid), '''[a-z_0-9]+_seq[0-9]*''', '''<seq>'''), '')
FROM pg_class c
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'v', 'm')
UNION ALL
-- constraints by definition (no name)
SELECT 'con ' || conrelid::regclass || ' ' || contype::text || ' ' || pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype <> 'n'
UNION ALL
-- indexes by definition (no name)
SELECT 'idx ' || regexp_replace(pg_get_indexdef(i.indexrelid), 'INDEX \S+ ON', 'INDEX ON')
FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
WHERE c.relnamespace = 'public'::regnamespace
UNION ALL
-- triggers: name matters (firing order), function name does not
SELECT 'trg ' || tgrelid::regclass || ' ' || tgname || ' ' ||
       regexp_replace(pg_get_triggerdef(t.oid), ' EXECUTE FUNCTION .*$', '')
FROM pg_trigger t WHERE NOT tgisinternal AND tgrelid::regclass::text NOT LIKE 'hdb_%'
  AND (SELECT relnamespace FROM pg_class WHERE oid = tgrelid) = 'public'::regnamespace
UNION ALL
-- functions callable from Hasura / views (signature only)
SELECT 'fn ' || p.oid::regprocedure || ' -> ' || pg_get_function_result(p.oid)
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.prorettype <> 'trigger'::regtype
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
UNION ALL
-- enums
SELECT 'enum ' || t.typname || ' ' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typnamespace = 'public'::regnamespace GROUP BY t.typname
UNION ALL
-- privileges on tables (history must stay append-only)
SELECT 'acl ' || c.relname || ' ' || coalesce(array_to_string(c.relacl, ','), '<default>')
FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
UNION ALL
-- owners (hooks refresh the materialized views as their owner; sequences are renamed)
SELECT 'own ' || c.relkind::text || ' ' || c.relname || ' ' || c.relowner::regrole
FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'v', 'm')
UNION ALL
SELECT 'own fn ' || p.oid::regprocedure || ' ' || p.proowner::regrole
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.prorettype <> 'trigger'::regtype
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
UNION ALL
-- encoding and collation (text ordering in indexes and ORDER BY)
SELECT 'db ' || pg_encoding_to_char(encoding) || ' ' || datlocprovider::text || ' ' || datcollate || ' ' || datctype
FROM pg_database WHERE datname = current_database()
ORDER BY 1;
SQL
)

old=$(psql "$OLD_DB" -X -q -v ON_ERROR_STOP=1 -tA -c "$Q" | sed -E -e "$RENAME_SED" -e "$ACL_SED" | sort)
new=$(psql "$NEW_DB" -X -q -v ON_ERROR_STOP=1 -tA -c "$Q" | sed -E -e "$ACL_SED" | sort)
actual=$( (diff <(echo "$old") <(echo "$new") || true) | sed -n -E 's/^< /- /p; s/^> /+ /p' | sort)
expected=$( (grep -v -e '^#' -e '^$' "$(dirname "$0")/schema-compare.expected" || true) | sort)
if [ "$actual" = "$expected" ]; then
  echo "schemas are structurally identical ($(echo "$new" | wc -l) items)" \
       "apart from the $(echo "$expected" | grep -c .) expected differences"
else
  echo "unexpected differences (> only in actual, < only in schema-compare.expected):"
  diff <(echo "$expected") <(echo "$actual") | grep '^[<>]' || true
  exit 1
fi
