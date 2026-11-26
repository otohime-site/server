# PostgreSQL 16 → 19 upgrade

The database moves from PostgreSQL 16 to 19. The blocker was the `periods` extension,
which kept the score history: it has no PG 19 package. The work is done in two
maintenance windows, both rehearsed first on a copy of production:

1. **Window 1, on PG 16:** replace `periods` with plain PL/pgSQL triggers
   (`1795241435242_replace_periods_with_triggers`). This is the largest change to the
   existing data, so it goes alone and runs in production for a while before the cutover.
2. **Window 2, the cutover:** add the DX score columns and make
   `dx_intl_rating_target_stats` deterministic on PG 16, then start an empty PG 19 with a
   new, hand-written schema (`init.sql`), copy the data over table by table, check that
   everything matches, and switch Hasura, hooks and the web app to it. The old database
   stays as the way back.

While the schema is rebuilt anyway, the cutover also:

- renames `dx_intl_notes` / `finale_notes` to `dx_intl_charts` / `finale_charts`, which
  is what they actually hold;
- drops the unused `id` columns of `dx_intl_records` and `dx_intl_scores` (see
  [Dropping the unused ids](#dropping-the-unused-ids));
- replaces the single-row `dx_intl_constants` (`active_since`,
  `current_version_threshold`) with `dx_intl_versions`, one row per release
  (`version`, `released_at`). `transfer.sh` converts the old row into the current
  version's row (`threshold + 1`, `active_since`); the seed adds the older releases.

### Words used below

- **`periods`**: the extension that gave `dx_intl_records` and `dx_intl_scores` "system
  versioning". Each row carries `start`/`end` timestamps, and every time a row changes,
  the old version is copied into `<table>_history`. PlayerHistory is built from this.
- **Old side / new side**: the PG 16 database we move from, and the PG 19 database we
  move to.
- **Baseline**: a single migration, `migrations/default/1795720325269_init/up.sql` (called
  `init.sql` below), that creates the whole schema, replacing the old migration folders.
- **Upsert**: what the bookmarklet import does: `INSERT … ON CONFLICT DO UPDATE` through
  Hasura, "insert this row, or update it if it already exists".

## The steps at a glance

| Step | Where | What happens | Way back |
|---|---|---|---|
| **Rehearsal** | scratch containers, production dump | Everything below, timed | nothing to undo |
| **Window 1** | production, PG 16 | `periods` → triggers, history removal on player deletion, cleanup cron removed | `--down 1` + the previous hooks and metadata |
| **Window 2** | production | DX score + stable rating target stats on PG 16, PG 19 cutover, one web release | the old database (after `--down 2`) until the new one takes writes |
| **Afterwards** | repository | Remove the upgrade scripts and the old database service | — |

Why this split:

- Window 1 changes how every write to the two biggest tables is recorded. Running it
  alone, on the database we already know, keeps the cutover small, and it gets real
  traffic before PG 19 is involved.
- The DX score needs the new web app, and so does the rename at the cutover.
  Putting both in window 2 means one web release, and old bookmarklets break only once.
- `migrate apply` applies every migration in the checked-out tree, so window 1 must be
  deployed from the commit that adds only the trigger migration, not from a later one.

Each window needs minutes, not hours: on a production-sized copy, every migration took
seconds, and copying plus verifying the whole database about two minutes.

---

## Rehearsal on a production dump

Do it close to the window, with a fresh dump. The dump holds personal data: keep it out
of the repository, use only local containers on an internal network without published
ports, and delete the copies and volumes afterwards.

**Preparation**

- **R0.** Take a fresh dump and check its checksum. Note the format (`head -c 5`: `PGDMP`
  = custom, else plain SQL), production's `SELECT version()` and `\dx periods`.
- **R1.** Build the PG 16 image (`docker-db16/`, `docker-db/` before this branch: PG 16 +
  `periods`) and start it on a new volume.
- **R2.** Restore with `session_replication_role = replica`, so that `periods`' event
  trigger doesn't reject the GRANTs:
  - custom: `PGOPTIONS="-c session_replication_role=replica" pg_restore -U postgres -d otohime dump`
  - plain: `PGOPTIONS="-c session_replication_role=replica" psql -U postgres -d otohime -f dump.sql`

  Only "already exists" for `hdb_catalog` / `hdb_views` is expected (`init.sh` creates
  them). The dump must include `hdb_catalog`: the Hasura v2 CLI keeps its migration state
  in `hdb_catalog.hdb_version.cli_state` (the `schema_migrations` table there is a v1
  leftover and may be empty).
- **R3.** Record a baseline: row counts, the number of orphan history rows (history of
  players that no longer exist, which window 1 deletes), sequence values,
  `periods.system_versioning` (2 rows), content digests of the versioned tables.

**Window 1**

- **R4.** At the window 1 commit, `migrate apply` and `metadata apply
  --disallow-inconsistent-metadata` with the Hasura CLI. Then check: `periods` manages
  nothing, 11 triggers exist, no orphan history is left, the "Cleanup Players" cron is
  gone, and the content digests are unchanged.
- **R5.** With Hasura on the copy, as the `importer` and `user` roles: an upsert writes one
  history row whose `end` equals the new `start`; an unchanged upsert writes nothing;
  deleting a player leaves no history.
- **R6.** Way back: `migrate apply --down 1` with the previous commit's metadata. `periods`
  is back with 2 registrations, the history is SELECT-only, the cron is back. Then apply
  window 1 again.

**Window 2**

- **R7.** At the window 2 commit, apply the DX score and stable rating target stats
  migrations, then `metadata apply`. 12 triggers, every DX CHECK validated.
- **R8.** Start a scratch PG 19 from `docker-db/`, load `init.sql` as
  `otohime`. `schema-compare.sh` must print `structurally identical (…) apart from the 33
  expected differences`.
- **R9.** `transfer.sh`, then `verify.sh`: `ALL CHECKS PASSED`, with no warning.
- **R10.** Hasura against both sides (old with the window 2 metadata, new with the renamed
  metadata). `web-compare.mjs` with real fixtures (a large public player, a private player,
  a user that owns players): every query `same` or `ORDR`.
- **R11.** With the new web build: a real bookmarklet import on the new side,
  PlayerHistory, and deleting a test player.
- **R12.** Way back: on the old copy, `migrate apply --down 2`, then the window 1
  metadata. The DX columns are gone and the data equals the state after window 1.

---

## Window 1: `periods` → triggers (production, PG 16)

1. Stop the writers: `docker compose stop hasura hooks`. Take a backup dump.
2. Check out the window 1 commit and `mkdir -p seeds` as yourself: the maintenance CLI
   runs as root and would otherwise create `seeds/` owned by root, which makes the later
   checkout of this branch fail. `migrate status` must list exactly one migration as not
   applied: `1795241435242_replace_periods_with_triggers`.
3. `./scripts/hasura-maintenance migrate apply --all-databases`, then
   `./scripts/hasura-maintenance metadata apply --disallow-inconsistent-metadata`
   (this removes the "Cleanup Players" cron). After the migration:
   - `periods` no longer manages these two tables, and three triggers do its job (see
     [How the replacement triggers work](#how-the-replacement-triggers-work)).
   - The `*_with_history` views are recreated with the same names and columns, so
     Hasura doesn't notice.
   - The `"end" = 'infinity'` CHECKs, which `periods` drops when it detaches, are put back.
   - History rows can't be updated or truncated. Only a deleted player's history can be
     deleted, and a deferred trigger on `dx_intl_players` does that when the deleting
     transaction commits. History already left behind by deleted players is removed.
4. Rebuild and start `hooks` (without the `/cleanup` route), then start `hasura`.
5. Check: after a real import, the newest `dx_intl_scores_history` row has an `end`
   equal to the `start` of the current row. Deleting a test player leaves no history.

**Going back:** while still at the window 1 commit (the `down.sql` must be in the tree),
`./scripts/hasura-maintenance migrate apply --database-name default --down 1`, then the
previous commit's hooks and metadata (the cron comes back with it). The order of hooks
and migration doesn't matter: in either mismatch, the old cleanup call fails and rolls
back.

## Window 2: DX score and the PG 19 cutover

Before it: the otohime-web DX change, the `pg19` branch, and a rehearsal
that passed.

6. Stop the writers (`docker compose stop hasura hooks`) and take a backup dump. The old
   database keeps running.
7. At the window 2 commit on PG 16: `migrate status` lists exactly
   `1795283713177_dx_intl_scores_dx_score` and
   `1795718536721_dx_intl_rating_target_stats_stable`; `migrate apply --all-databases`,
   then `metadata apply --disallow-inconsistent-metadata` (the view is dropped and
   recreated). The stable view comes before the cutover so that `init.sql` has the same
   definition and `verify.sh` must find identical rows on both sides. The DX score must
   come after window 1: while `periods` still manages `dx_intl_scores`, its event
   triggers react to `ALTER TABLE` on that table, and that interaction is untested.
8. Check out the `pg19` branch. Start the old database as `db16` (on its existing volume)
   and the new PG 19 `db` on an empty volume. Its `init.sh` creates the `otohime` role.
9. Load the schema as `otohime`:
   `psql -U otohime -d otohime -1 -v ON_ERROR_STOP=1 -f migrations/default/1795720325269_init/up.sql`.
10. From the new db container (copy this directory into it). The new side needs a
    superuser (local socket); the old side is only read, so the owner `otohime` is
    enough. This also avoids relying on `POSTGRES_PASSWORD`, which only takes effect
    when a volume is first created and may no longer match the old database:
    ```sh
    export PGPASSWORD=$POSTGRES_DB_PASSWORD
    OLD_DB=postgresql://otohime@db16/otohime NEW_DB=postgresql://postgres@localhost/otohime
    ./schema-compare.sh && ./transfer.sh && ./verify.sh
    ```
    If any of them fails: stop, drop and recreate the new database, then either fix the
    problem or go back.
11. Tell Hasura about the new database:
    ```sh
    ./scripts/hasura-maintenance migrate apply --database-name default --version 1795720325269 --skip-execution
    ./scripts/hasura-maintenance metadata apply --disallow-inconsistent-metadata
    ./scripts/hasura-maintenance metadata ic list      # must be consistent
    ```
    `--skip-execution` marks the baseline as applied without running it, because the
    tables already exist. For the same reason, don't let a `cli-migrations` image start
    against the transferred database with `migrations/` mounted: it would run `init.sql`
    again.
12. Start `hooks` (with the rename) and `hasura`, and deploy the web app (DX score +
    rename) at the same time.
13. Smoke test: one import with a DX score, one PlayerHistory page, one player deletion.
14. Keep the old volume and image for a few weeks before removing them.

**Going back:** until step 12, nothing has written to the new database. Stop it, start
the old database as `db` again, undo both PG 16 migrations (`migrate apply --down 2` at
the window 2 commit), then start the old `hasura` / `hooks` with the window 1 metadata
and the old web build. Without that `down`, old bookmarklets would be rejected. After
step 12, going back loses every write made since the cutover (there is no script to
copy data back), so make the go/no-go decision right after the smoke test.

**Fresh dev installs** after the cutover: PG 19 + `hasura migrate apply` (this time it
does run `init.sql`) + `hasura seed apply` + `hasura metadata apply`. Tested; the result
has the same structure as a transferred database.

### Changes that ship with the cutover

- **hooks:** `hooks/src/fetch.ts`: `INSERT INTO dx_intl_notes` → `dx_intl_charts`; the
  tests use `dx_intl_charts` too.
- **otohime-web:**
  - `src/dx_intl/models/queries.ts`: `dx_intl_notes(` → `dx_intl_charts(`
  - `src/dx_intl/models/aggregation.ts`: `variant.dx_intl_notes` → `variant.dx_intl_charts`
  - `src/finale/models/queries.ts` / `aggregation.ts`: `finale_notes` → `finale_charts`
    (the relationship on `finale_songs`)
  - regenerate `graphql-env.d.ts`. This also drops `id` and changes the `_by_pk`
    arguments, but no query uses either.

  The old web app **breaks** against the new API, so deploy the web change right as the
  new Hasura comes up.
- **Compose:** the new `db` service builds `docker-db/` (PG 19) on a new volume, mounted
  at `/var/lib/postgresql` without the `PGDATA` override (PG 18+ images keep their data in
  `/var/lib/postgresql/<ver>/docker`). The old database stays as a separate service
  (`db16`, on the existing volume, behind a profile) for the transfer and for going back.
- **README:** `periods` is no longer installed.

### Files

| File | What it is |
|---|---|
| `migrations/default/1795720325269_init/up.sql` | The new baseline schema (`init.sql`): `dx_intl_charts`, trigger-based history, tidied constraint and index names, no `id` on `dx_intl_records` / `dx_intl_scores`. Its `down.sql` is a comment only |
| `seeds/default/1795720325269_versions.sql` | The `dx_intl_versions` rows (release time of each version). Needed on fresh installs; optional after the transfer, which already converts the current version's row. Existing versions are left alone, so it is safe to apply either way |
| `metadata/` | Renamed for the new schema: `dx_intl_notes` / `finale_notes` → `dx_intl_charts` / `finale_charts`, relationships `*_note(s)` → `*_chart(s)`, `id` removed from the column lists. `finale_scores_with_history.finale_chart` now points at `finale_charts` (as `finale_note` it pointed at `finale_scores` by mistake) |
| `docker-db/`, `docker-db16/` | `FROM postgres:19` without `periods` / `btree_gist`; the old PG 16 image for `db16` |
| `schema-compare.sh`, `schema-compare.expected` | Compares the structure of old and new (read-only). Passes only when the differences are exactly the expected list |
| `transfer.sh` | Safety checks (different databases, empty target, both UTF8, no other client connected to the old database), then copies every table (minus the columns in its `DROPPED` list; `dx_intl_constants` is converted into `dx_intl_versions`), sets sequences, refreshes the materialized views, runs ANALYZE |
| `verify.sh` | Compares row counts and hashes of every table and view, checks foreign keys, sequences, triggers and materialized views. Row hashes are combined in 256 buckets, so large tables stay well under Postgres's 1 GB value limit |
| `web-compare.mjs` | Sends every otohime-web query to old and new Hasura and compares the answers (reads the web sources as text only) |

`init.sql` keeps the two constraint names the web app uses in `on_conflict`:
`dx_intl_records_player_id_key` and
`dx_intl_scores_player_id_song_id_deluxe_difficulty_key` (they are now the primary keys).
Other constraint, index and sequence names lose their `1` suffixes; those appear only in
the generated `graphql-env.d.ts`.

---

## Why it is done this way

### Why not just upgrade?

- **`periods` has no PG 19 package.** apt.postgresql.org has `postgresql-16/17/18-periods`,
  but no `postgresql-19-periods` (checked 2026-11-21).
- **`pg_upgrade` or `pg_dump`/`pg_restore` would carry `periods` along**, and every old
  naming quirk with it.
- **`hasura migrate squash`** only joins the old `up.sql` files together, so the result
  would still call `periods`.

### Why a new schema plus COPY

- A hand-written `init.sql` is short enough to review. `schema-compare.sh` then proves it
  has the same structure as production: columns, types, defaults, constraints, indexes,
  triggers, functions, enums, privileges and owners are compared by their definitions,
  ignoring the names renamed on purpose, plus the database encoding and collation (both
  images use UTF8 with libc `en_US.utf8`). The intended structural changes are listed in
  `schema-compare.expected`, and the real differences must match that list exactly.
- Copying with explicit column lists, matched by name, handles the table rename and any
  difference in column order.
- **One catch:** unlike `pg_restore`, `COPY FROM` *fires triggers*. Left alone, the
  history trigger would stamp every copied row with the time of the transfer and lose the
  real `start`/`end`. So `transfer.sh` loads with `session_replication_role = replica`,
  which skips user triggers and foreign-key checks; CHECK, NOT NULL and UNIQUE are still
  enforced. `verify.sh` then checks the foreign keys separately.
- Hasura's own tables (`hdb_catalog`) are **not** copied. The new database starts with an
  empty catalog, the metadata is applied from git, and the baseline is marked as applied.
  Old event and cron logs are lost, but `cleanup.ts` deletes them after 3 months anyway.
- The scripts only ever read the old database (every session they open is read-only).

### How the replacement triggers work

Three small PL/pgSQL functions replace `periods`, attached to both tables:

- **`system_time_generated_always`** (before every insert or update): sets
  `start = transaction_timestamp()` and `end = 'infinity'`, so clients can't fake them.
- **`system_time_write_history`** (after every update or delete): copies the old version
  of the row into `<table>_history` with `end` set to now. If the row was already
  written earlier in the same transaction, no history row is written, so there are no
  zero-length entries.
- **`system_time_truncate_history`** (after TRUNCATE): empties the history table too.

The history row is built as `jsonb_populate_record(NULL::<table>_history, to_jsonb(OLD))`.
That maps columns by name, so the history table doesn't need the same column order. It
is lossless for every type these tables use (numeric keeps its digits, timestamptz its
offset and microseconds; tested by round-tripping real rows under a non-UTC session time
zone). The catch: a column that exists only in the base table is silently dropped, so a
new column must be added to the history table too (as the DX score migration does).

The triggers keep the names `periods` used. That matters because Postgres runs BEFORE
triggers in alphabetical order: `*_check_changed` (which drops upserts that change
nothing) must run first, then `*_require_dx_score`, then `*_system_time_generated_always`.

### Dropping the unused ids

**The problem.** When Postgres runs an upsert, it fills in column defaults for every
proposed row *before* it checks whether the row already exists. One of those defaults is
`nextval()` for the `id` column. So every row the bookmarklet sends uses up an id, even
when the row only gets updated, turns out unchanged, or the whole import is rolled back.
Both sequences are far ahead of the number of rows the tables can hold. This isn't
urgent (the ids won't run out, and nothing reads them: the web app never selects `id`,
the upserts look rows up by their natural keys, and no foreign key points at `id`), but
dropping them saves an index per table and 8 bytes per score and score-history row.

**The fix.** The natural keys become the primary keys:

- `dx_intl_records`: `player_id`, keeping the name `dx_intl_records_player_id_key`.
- `dx_intl_scores`: `(player_id, song_id, deluxe, difficulty)`, keeping the name
  `dx_intl_scores_player_id_song_id_deluxe_difficulty_key`.
- `dx_intl_records_history`, `dx_intl_scores_history`: no `id` and no primary key. They
  are only appended to and read by `player_id`.
- The views built with `SELECT *` and the materialized views have one column less.

Hasura supports multi-column primary keys (`_by_pk` then takes every key column; the web
app doesn't use it). Renaming a `dx_intl_charts` `song_id` still cascades into
`dx_intl_scores`.

**Why during the cutover.** `init.sql` simply defines the tables without `id`: no extra
migration, no table lock, no `down.sql`. Going back means going back to the old
database, which still has every original id.

**Alternatives rejected:**
- Assigning the id in a BEFORE INSERT trigger: upserts run those before the conflict
  check too.
- `MERGE`, which fills defaults only for rows it really inserts: Hasura can't run it.
- Sending only new or changed charts from the bookmarklet: less waste, but still some.
- A separate migration after the cutover: it would have to drop and recreate every
  `SELECT *` view and the materialized views under exclusive locks, and its `down.sql`
  couldn't bring back the original ids.

**What the tools do about it:** `transfer.sh`'s `DROPPED` list names the four old-only
`id` columns (the safety check fails if an entry isn't exactly a column that exists only
on the old side). `verify.sh` hashes rows using the new side's columns. `schema-compare.sh`
expects the 33 differences in `schema-compare.expected` (16 for the ids, 17 for
`dx_intl_versions`).

### DX score

New columns `dx_score` / `max_dx_score` on `dx_intl_scores`, deployed on PG 16 in window
2 just before the transfer, so the cutover carries them like any other column.

| Rule | Enforced by |
|---|---|
| Both columns may be NULL: rows imported before this change have neither | every CHECK passes on NULL |
| They are NULL together or set together | `dx_intl_scores_dx_score_pair_check` |
| `max_dx_score > 0` and divisible by 3 (3 points per note) | `dx_intl_scores_max_dx_score_check` |
| `0 <= dx_score <= max_dx_score` | `dx_intl_scores_dx_score_check` |
| `dx_score = max_dx_score` means `score = 101` (but not the other way round) | `dx_intl_scores_dx_score_max_check` |
| From now on, a chart is either missing (unplayed) or has both `score` and `dx_score`. `dx_score = 0` is valid (played only before maimai DX) | the parser (both values or neither) + trigger `dx_intl_scores_require_dx_score` |

**No parser change.** The current parser (`@otohime-site/parser` 26.11.0) already reads
both values and checks "both or neither", the range and the multiple of 3. The rule
"`dx_score = max_dx_score` means `score = 101`" is enforced by the database only: the
bookmarklet reads the official DX NET pages, whose data always satisfies it, so a
violation means the data wasn't obtained from DX NET. Such an import is rejected as a
whole with Hasura's generic "Check constraint violation", which is accepted.

The trigger rejects a missing `dx_score` when a row is inserted, when `score`,
`combo_flag` or `sync_flag` changes, or when an existing `dx_score` would be cleared.
Otherwise old rows can still be updated, so a `song_id` rename still cascades. A CHECK
can't express this: even a `NOT VALID` one is checked on every UPDATE.

The history table gets the same two columns in the same order: `*_with_history` glues
the two tables together by column position.

**Bookmarklets opened before the deploy will fail.** They send no `dx_score`, so every
import from them is rejected, even one where nothing changed: Postgres runs the BEFORE
INSERT trigger on every proposed row before it notices the row already exists. Reloading
the page fixes it. Releasing the web change together with the migration keeps this short.

**One extra history row per old score (accepted).** A player's first import after this
change writes one history row for each existing score: the old version, with `dx_score`
NULL. Filling in `dx_score` without a history row would claim the player had that DX
score since `start`, which may not be true.

### Stable rating target stats

Both `row_number()` windows in `dx_intl_rating_target_stats` ordered by values that can
tie, so which tied chart survived the top-15/35 cutoff depended on row order and the
query plan: two copies of the same data disagreed on about a tenth of the rows. The
chart key is now the last sort key. It is unique within each window partition, so the
result is deterministic: identical on PG 16 and PG 19, and after the scores table is
rewritten in another order. Refresh time is unchanged.

---

## Tests

- **Automated:** `hooks/tests/history.test.ts` and `hooks/tests/dx-score.test.ts` build a
  fresh database from `migrations/` on the `docker-db/` image, as a non-superuser owner,
  and run in CI. Locally: `TEST_DATABASE_URL=postgres://postgres:…@localhost:5432/postgres
  pnpm test` in `hooks/`.
- **Synthetic data** (thousands of players, awkward text, NULLs, every upsert case):
  `periods` and the triggers produce identical history; `transfer.sh` + `verify.sh` pass;
  the scripts' safety checks refuse the same database under another URL, a non-empty
  target and a connected client; `verify.sh` catches one changed history row;
  `schema-compare.sh` catches a wrong owner.
- **Copy of the dev database** and **production dump**: the full rehearsal above,
  including both ways back, Hasura with real fixtures, and a fresh install from the
  baseline that has the same structure as a transferred database.
