-- otohime: clean baseline schema (replaces migrations 1603703037948 .. 1795718536721)
--
-- Differences from the schema those migrations produce:
--   * dx_intl_notes / finale_notes are renamed to dx_intl_charts / finale_charts
--   * suffixes left by old rebuilds are removed (_pkey1, _fkey1, _check1, _seq1, ...)
--     and anonymous CHECKs get descriptive names
--   * system versioning uses plain triggers (no periods / btree_gist)
--   * dx_intl_records / dx_intl_scores and their history tables have no surrogate id:
--     Hasura upserts (INSERT ... ON CONFLICT) evaluate nextval() for every proposed row,
--     so a serial id was used up on every import even for unchanged rows. The natural
--     keys are the primary keys instead.
-- Kept as-is because clients use them in on_conflict (now the primary keys):
--   dx_intl_records_player_id_key, dx_intl_scores_player_id_song_id_deluxe_difficulty_key
-- Requires PostgreSQL 13+ (gen_random_uuid is built in). Run as the database owner (otohime).

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE dx_intl_combo_flag AS ENUM ('', 'fc', 'fc+', 'ap', 'ap+');
CREATE TYPE dx_intl_sync_flag AS ENUM ('', 's', 'fs', 'fs+', 'fdx', 'fdx+');
CREATE TYPE dx_intl_trophy AS ENUM ('normal', 'bronze', 'silver', 'gold', 'rainbow');
CREATE TYPE dx_intl_level AS ENUM (
    '1', '2', '3', '4', '5', '6', '7', '7+', '8', '8+', '9', '9+',
    '10', '10+', '11', '11+', '12', '12+', '13', '13+', '14', '14+', '15'
);

CREATE TYPE finale_combo_flag AS ENUM ('', 'fc_silver', 'fc_gold', 'ap', 'ap_plus');
CREATE TYPE finale_sync_flag AS ENUM ('', '100');
CREATE TYPE finale_level AS ENUM (
    '1', '2', '3', '4', '5', '6', '7', '7+', '8', '8+', '9', '9+',
    '10', '10+', '11', '11+', '12', '12+', '13', '13+', '14'
);

-- ---------------------------------------------------------------------------
-- System versioning (replacement for the periods extension)
-- A versioned table <t> needs "start"/"end" timestamptz columns and a <t>_history
-- twin with the same columns. Triggers must be named <t>_system_time_* so that
-- they fire after <t>_check_changed (BEFORE triggers fire in name order).
-- ---------------------------------------------------------------------------

CREATE FUNCTION system_time_generated_always() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    -- Like periods' GENERATED ALWAYS: client-supplied values are ignored.
    NEW."start" := transaction_timestamp();
    NEW."end" := 'infinity';
    RETURN NEW;
END;
$func$;

CREATE FUNCTION system_time_write_history() RETURNS trigger
LANGUAGE plpgsql AS $func$
DECLARE
    history regclass := format('%I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME || '_history')::regclass;
BEGIN
    -- A row already written in this transaction gets no zero-length history row.
    IF OLD."start" < transaction_timestamp() THEN
        OLD."end" := transaction_timestamp();
        -- Map by column name, not position.
        EXECUTE format('INSERT INTO %s SELECT * FROM jsonb_populate_record(NULL::%s, $1)', history, history)
        USING to_jsonb(OLD);
    END IF;
    RETURN NULL;
END;
$func$;

CREATE FUNCTION system_time_truncate_history() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    EXECUTE format('TRUNCATE %I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME || '_history');
    RETURN NULL;
END;
$func$;

-- Drops no-op UPDATEs (e.g. an upsert that re-sends identical values) so they
-- neither bump "start" nor write a history row.
CREATE FUNCTION skip_unchanged_update() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    RETURN CASE WHEN OLD IS DISTINCT FROM NEW THEN NEW ELSE NULL END;
END;
$func$;

-- ---------------------------------------------------------------------------
-- Users and tokens
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL UNIQUE REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- constraint names: tokens_pkey, tokens_user_id_key, tokens_user_id_fkey

CREATE TABLE token_transfers (
    id serial PRIMARY KEY,
    token_id uuid NOT NULL UNIQUE,
    old_user_id text NOT NULL,
    new_user_id text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- maimai DX international: master data
-- ---------------------------------------------------------------------------

CREATE TABLE dx_intl_versions (
    version smallint PRIMARY KEY CONSTRAINT dx_intl_versions_version_check CHECK (version >= 0),
    released_at timestamptz NOT NULL CONSTRAINT dx_intl_versions_released_at_key UNIQUE
);

-- When each maimai DX international version is (or will be) released, at the
-- 04:00 JST rollover; seeded from seeds/default/1795720325269_versions.sql.
-- The latest row whose released_at has passed is the current version. A scheduled
-- release can be inserted ahead of time: rows in the future are ignored until then.
-- A new version also needs a migration raising dx_intl_variants_version_check:
--   ALTER TABLE dx_intl_variants DROP CONSTRAINT dx_intl_variants_version_check,
--     ADD CONSTRAINT dx_intl_variants_version_check CHECK (version >= 0 AND version <= <new>);
-- dx_intl_rating_target_stats picks up a release on its next REFRESH.

CREATE TABLE dx_intl_songs (
    id varchar(64) PRIMARY KEY,
    category smallint NOT NULL CONSTRAINT dx_intl_songs_category_check CHECK (category >= 1 AND category <= 6),
    title text NOT NULL,
    "order" smallint NOT NULL CONSTRAINT dx_intl_songs_order_check CHECK ("order" >= 1),
    artist text,
    title_kana text,
    CONSTRAINT dx_intl_songs_category_title_key UNIQUE (category, title)
);
CREATE INDEX dx_intl_songs_category_order_idx ON dx_intl_songs (category, "order");

CREATE TABLE dx_intl_variants (
    song_id varchar(64) NOT NULL REFERENCES dx_intl_songs (id) ON UPDATE CASCADE ON DELETE CASCADE,
    deluxe boolean NOT NULL,
    version smallint NOT NULL CONSTRAINT dx_intl_variants_version_check CHECK (version >= 0 AND version <= 26),
    active boolean NOT NULL,
    PRIMARY KEY (song_id, deluxe)
);

CREATE TABLE dx_intl_charts (
    song_id varchar(64) NOT NULL,
    deluxe boolean NOT NULL,
    difficulty smallint NOT NULL CONSTRAINT dx_intl_charts_difficulty_check CHECK (difficulty >= 0 AND difficulty <= 4),
    level dx_intl_level NOT NULL,
    internal_lv numeric(3, 1),
    PRIMARY KEY (song_id, deluxe, difficulty),
    FOREIGN KEY (song_id, deluxe) REFERENCES dx_intl_variants (song_id, deluxe) ON UPDATE CASCADE ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- maimai DX international: players, records, scores (system-versioned)
-- ---------------------------------------------------------------------------

CREATE TABLE dx_intl_players (
    id serial PRIMARY KEY,
    user_id text NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    nickname text NOT NULL UNIQUE
        CONSTRAINT dx_intl_players_nickname_check CHECK (nickname <> 'new' AND nickname ~ '^[0-9a-z\-\_]{1,20}$'),
    "private" boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dx_intl_players_nickname_idx ON dx_intl_players USING gin (nickname gin_trgm_ops);

CREATE TABLE dx_intl_records (
    player_id integer NOT NULL REFERENCES dx_intl_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    card_name text NOT NULL,
    title text NOT NULL,
    trophy dx_intl_trophy NOT NULL,
    rating smallint NOT NULL,
    max_rating smallint NOT NULL,
    grade integer,
    start timestamptz NOT NULL DEFAULT transaction_timestamp(),
    "end" timestamptz NOT NULL DEFAULT 'infinity',
    course_rank smallint,
    class_rank smallint,
    rating_legacy boolean NOT NULL DEFAULT true,
    CONSTRAINT dx_intl_records_player_id_key PRIMARY KEY (player_id),
    CONSTRAINT dx_intl_records_max_rating_check
        CHECK (max_rating = -1 OR (max_rating >= 0 AND max_rating < 15000 AND max_rating >= rating)),
    CONSTRAINT dx_intl_records_ranks_check CHECK (
        (course_rank IS NULL AND class_rank IS NULL AND grade IS NOT NULL AND (grade >= 1 AND grade <= 25))
        OR (course_rank IS NOT NULL AND course_rank >= 0 AND course_rank <= 23 AND course_rank <> 11
            AND class_rank IS NOT NULL AND class_rank >= 0 AND class_rank <= 25 AND grade IS NULL)
    ),
    CONSTRAINT dx_intl_records_rating_check CHECK (rating >= 0 AND rating <= 17000),
    CONSTRAINT dx_intl_records_rating_legacy_check CHECK (rating <= 10350 OR rating_legacy IS FALSE),
    CONSTRAINT dx_intl_records_system_time_check CHECK (start < "end"),
    CONSTRAINT dx_intl_records_end_infinity_check CHECK ("end" = 'infinity')
);
CREATE INDEX dx_intl_records_card_name_idx ON dx_intl_records USING gin (card_name gin_trgm_ops);

-- No FK on history: a deleted player's history is removed by dx_intl_players_purge_history.
CREATE TABLE dx_intl_records_history (
    player_id integer NOT NULL,
    card_name text NOT NULL,
    title text NOT NULL,
    trophy dx_intl_trophy NOT NULL,
    rating smallint NOT NULL,
    max_rating smallint NOT NULL,
    grade integer,
    start timestamptz NOT NULL,
    "end" timestamptz NOT NULL,
    course_rank smallint,
    class_rank smallint,
    rating_legacy boolean NOT NULL DEFAULT true
);
CREATE INDEX dx_intl_records_history_player_id_idx ON dx_intl_records_history (player_id);

CREATE TABLE dx_intl_scores (
    player_id integer NOT NULL REFERENCES dx_intl_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    song_id varchar(64) NOT NULL,
    deluxe boolean NOT NULL,
    difficulty smallint NOT NULL,
    score numeric(7, 4) NOT NULL CONSTRAINT dx_intl_scores_score_check CHECK (score >= 0 AND score <= 101.00),
    combo_flag dx_intl_combo_flag NOT NULL,
    sync_flag dx_intl_sync_flag NOT NULL,
    start timestamptz NOT NULL DEFAULT transaction_timestamp(),
    "end" timestamptz NOT NULL DEFAULT 'infinity',
    CONSTRAINT dx_intl_scores_player_id_song_id_deluxe_difficulty_key PRIMARY KEY (player_id, song_id, deluxe, difficulty),
    CONSTRAINT dx_intl_scores_song_id_deluxe_difficulty_fkey FOREIGN KEY (song_id, deluxe, difficulty)
        REFERENCES dx_intl_charts (song_id, deluxe, difficulty) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT dx_intl_scores_ap_plus_check CHECK (combo_flag <> 'ap+' OR score = 101.00),
    CONSTRAINT dx_intl_scores_fdx_plus_check CHECK (sync_flag <> 'fdx+' OR combo_flag = 'ap' OR combo_flag = 'ap+'),
    CONSTRAINT dx_intl_scores_system_time_check CHECK (start < "end"),
    CONSTRAINT dx_intl_scores_end_infinity_check CHECK ("end" = 'infinity'),
    -- DX score: both NULL for rows imported before it was recorded
    dx_score integer,
    max_dx_score integer,
    CONSTRAINT dx_intl_scores_dx_score_pair_check CHECK ((dx_score IS NULL) = (max_dx_score IS NULL)),
    CONSTRAINT dx_intl_scores_max_dx_score_check CHECK (max_dx_score > 0 AND max_dx_score % 3 = 0),
    CONSTRAINT dx_intl_scores_dx_score_check CHECK (dx_score >= 0 AND dx_score <= max_dx_score),
    CONSTRAINT dx_intl_scores_dx_score_max_check CHECK (dx_score <> max_dx_score OR score = 101.00)
);

-- New data must carry dx_score: a chart is either absent (unplayed) or has both a
-- score and a DX score. Legacy rows (dx_score NULL) stay valid as long as their play
-- result is unchanged, so cascaded song_id renames still work.
CREATE FUNCTION dx_intl_scores_require_dx_score() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    IF NEW.dx_score IS NULL AND (
        TG_OP = 'INSERT'
        OR OLD.dx_score IS NOT NULL
        OR (NEW.score, NEW.combo_flag, NEW.sync_flag)
            IS DISTINCT FROM (OLD.score, OLD.combo_flag, OLD.sync_flag)
    ) THEN
        RAISE EXCEPTION 'dx_score is required for new scores'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$func$;

CREATE TABLE dx_intl_scores_history (
    player_id integer NOT NULL,
    song_id varchar(64) NOT NULL,
    deluxe boolean NOT NULL,
    difficulty smallint NOT NULL,
    score numeric(7, 4) NOT NULL,
    combo_flag dx_intl_combo_flag NOT NULL,
    sync_flag dx_intl_sync_flag NOT NULL,
    start timestamptz NOT NULL,
    "end" timestamptz NOT NULL,
    dx_score integer,
    max_dx_score integer
);
CREATE INDEX dx_intl_scores_history_player_id_idx ON dx_intl_scores_history (player_id);

CREATE TRIGGER dx_intl_records_check_changed
    BEFORE UPDATE ON dx_intl_records
    FOR EACH ROW EXECUTE FUNCTION skip_unchanged_update();
CREATE TRIGGER dx_intl_records_system_time_generated_always
    BEFORE INSERT OR UPDATE ON dx_intl_records
    FOR EACH ROW EXECUTE FUNCTION system_time_generated_always();
CREATE TRIGGER dx_intl_records_system_time_write_history
    AFTER UPDATE OR DELETE ON dx_intl_records
    FOR EACH ROW EXECUTE FUNCTION system_time_write_history();
CREATE TRIGGER dx_intl_records_truncate
    AFTER TRUNCATE ON dx_intl_records
    FOR EACH STATEMENT EXECUTE FUNCTION system_time_truncate_history();

CREATE TRIGGER dx_intl_scores_check_changed
    BEFORE UPDATE ON dx_intl_scores
    FOR EACH ROW EXECUTE FUNCTION skip_unchanged_update();
CREATE TRIGGER dx_intl_scores_require_dx_score
    BEFORE INSERT OR UPDATE ON dx_intl_scores
    FOR EACH ROW EXECUTE FUNCTION dx_intl_scores_require_dx_score();
CREATE TRIGGER dx_intl_scores_system_time_generated_always
    BEFORE INSERT OR UPDATE ON dx_intl_scores
    FOR EACH ROW EXECUTE FUNCTION system_time_generated_always();
CREATE TRIGGER dx_intl_scores_system_time_write_history
    AFTER UPDATE OR DELETE ON dx_intl_scores
    FOR EACH ROW EXECUTE FUNCTION system_time_write_history();
CREATE TRIGGER dx_intl_scores_truncate
    AFTER TRUNCATE ON dx_intl_scores
    FOR EACH STATEMENT EXECUTE FUNCTION system_time_truncate_history();

-- History rows are never changed, and only a deleted player's history may be removed.
CREATE FUNCTION dx_intl_history_require_deleted_player() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    IF EXISTS (SELECT 1 FROM dx_intl_players WHERE id = OLD.player_id) THEN
        RAISE EXCEPTION 'history of an existing player cannot be deleted'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
END;
$func$;

CREATE TRIGGER dx_intl_records_history_require_deleted_player
    BEFORE DELETE ON dx_intl_records_history
    FOR EACH ROW EXECUTE FUNCTION dx_intl_history_require_deleted_player();
CREATE TRIGGER dx_intl_scores_history_require_deleted_player
    BEFORE DELETE ON dx_intl_scores_history
    FOR EACH ROW EXECUTE FUNCTION dx_intl_history_require_deleted_player();

REVOKE ALL ON dx_intl_records_history, dx_intl_scores_history FROM CURRENT_USER;
GRANT SELECT, INSERT, DELETE ON dx_intl_records_history, dx_intl_scores_history TO CURRENT_USER;

-- A deleted player's history is removed when the deleting transaction commits. Deferred:
-- the cascaded deletes of the player's records and scores write their final history
-- rows after a plain AFTER DELETE trigger on dx_intl_players has already run.
CREATE FUNCTION dx_intl_players_purge_history() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    DELETE FROM dx_intl_records_history WHERE player_id = OLD.id;
    DELETE FROM dx_intl_scores_history WHERE player_id = OLD.id;
    RETURN NULL;
END;
$func$;

CREATE CONSTRAINT TRIGGER dx_intl_players_purge_history
    AFTER DELETE ON dx_intl_players
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION dx_intl_players_purge_history();

-- ---------------------------------------------------------------------------
-- maimai DX international: views and Hasura computed fields
-- ---------------------------------------------------------------------------

CREATE VIEW dx_intl_records_with_history AS
    SELECT * FROM dx_intl_records
    UNION ALL
    SELECT * FROM dx_intl_records_history;

CREATE VIEW dx_intl_scores_with_history AS
    SELECT * FROM dx_intl_scores
    UNION ALL
    SELECT * FROM dx_intl_scores_history;

CREATE VIEW dx_intl_players_timelines AS
    WITH make_it_read_only AS (SELECT 1)
    SELECT id, nickname, ARRAY(
        SELECT start FROM (
            SELECT start FROM dx_intl_records WHERE player_id = p.id UNION ALL
            SELECT start FROM dx_intl_records_history WHERE player_id = p.id UNION ALL
            SELECT DISTINCT start FROM dx_intl_scores WHERE player_id = p.id UNION ALL
            SELECT DISTINCT start FROM dx_intl_scores_history WHERE player_id = p.id
        ) AS q GROUP BY start ORDER BY start DESC
    ) AS timelines
    FROM dx_intl_players p;

CREATE VIEW dx_intl_public_records AS
    SELECT r.* FROM dx_intl_records r
    JOIN dx_intl_players p ON p.id = r.player_id
    WHERE p.private = false;

CREATE VIEW dx_intl_public_scores AS
    SELECT s.* FROM dx_intl_scores s
    JOIN dx_intl_players p ON p.id = s.player_id
    WHERE p.private = false;

CREATE VIEW dx_intl_new_rating_stats AS
    WITH range_table AS (
        SELECT rating_range, format('%s - %s', lower(rating_range), upper(rating_range) - 1) AS description
        FROM unnest(ARRAY[
            int4range(4000, 7000), int4range(7000, 10000), int4range(10000, 12000),
            int4range(12000, 13000), int4range(13000, 14000), int4range(14000, 14500),
            int4range(14500, 15000), int4range(15000, 15500), int4range(15500, 16000),
            int4range(16000, NULL)
        ]) AS rating_range
    )
    SELECT min(rt.description) AS range, count(r.rating) AS count
    FROM (SELECT rating FROM dx_intl_public_records WHERE rating_legacy IS FALSE) r
    JOIN range_table rt ON rt.rating_range @> r.rating::integer
    GROUP BY rt.rating_range
    ORDER BY rt.rating_range DESC;

CREATE FUNCTION dx_intl_players_updated_at(dx_intl_players_row dx_intl_players) RETURNS timestamptz
LANGUAGE sql STABLE AS $$
    SELECT greatest(record_start, score_start)
    FROM
        (SELECT start AS record_start FROM dx_intl_records WHERE player_id = dx_intl_players_row.id) r CROSS JOIN
        (SELECT MAX(start) AS score_start FROM dx_intl_scores WHERE player_id = dx_intl_players_row.id) s;
$$;

CREATE FUNCTION dx_intl_get_base_rating(rating integer, grade integer) RETURNS integer
LANGUAGE sql STABLE AS $$
    SELECT (rating - CASE
        WHEN grade = 2 THEN 250
        WHEN grade = 3 THEN 500
        WHEN grade = 4 THEN 750
        WHEN grade = 5 THEN 1000
        WHEN grade = 6 THEN 1200
        WHEN grade = 7 THEN 1400
        WHEN grade = 8 THEN 1500
        WHEN grade = 9 THEN 1600
        WHEN grade = 10 THEN 1700
        WHEN grade = 11 THEN 1800
        WHEN grade = 12 THEN 1850
        WHEN grade = 13 THEN 1900
        WHEN grade = 14 THEN 1950
        WHEN grade = 15 THEN 2000
        WHEN grade = 16 THEN 2010
        WHEN grade = 17 THEN 2020
        WHEN grade = 18 THEN 2030
        WHEN grade = 19 THEN 2040
        WHEN grade = 20 THEN 2050
        WHEN grade = 21 THEN 2060
        WHEN grade = 22 THEN 2070
        WHEN grade = 23 THEN 2080
        WHEN grade = 24 THEN 2090
        WHEN grade = 25 THEN 2100
        ELSE 0
    END)
$$;

CREATE FUNCTION dx_intl_get_rating(internal_lv numeric, score numeric, ap boolean DEFAULT false) RETURNS integer
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    score_int  BIGINT;
    rank_const INTEGER;
BEGIN
    score_int := ROUND(score * 10000)::BIGINT;

    -- Pick the highest border that is still <= score_int (mirrors RANK_CONST_BORDERS reduce)
    SELECT rc.rank_const INTO rank_const
    FROM (VALUES
        ( 800000, 136),
        ( 899999, 144),
        ( 900000, 152),
        ( 939999, 160),
        ( 940000, 168),
        ( 969999, 176),
        ( 970000, 200),
        ( 980000, 203),
        ( 989999, 206),
        ( 990000, 208),
        ( 995000, 211),
        ( 999999, 214),
        (1000000, 216),
        (1004999, 222),
        (1005000, 224)
    ) AS rc(border, rank_const)
    WHERE rc.border <= score_int
    ORDER BY rc.border DESC
    LIMIT 1;

    IF rank_const IS NULL THEN
        RETURN 0;
    END IF;

    -- BIGINT / BIGINT performs truncation, equivalent to Math.floor() for positive values
    RETURN (
        rank_const::BIGINT
        * LEAST(1005000::BIGINT, score_int)
        * ROUND(internal_lv * 10)::BIGINT
        / 100000000
    )::INTEGER + CASE WHEN ap THEN 1 ELSE 0 END;
END;
$$;

-- ---------------------------------------------------------------------------
-- maimai DX international: statistics (materialized; refreshed by cron)
-- Unique indexes are required for REFRESH MATERIALIZED VIEW CONCURRENTLY.
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW dx_intl_scores_rates AS
    WITH st AS (
        SELECT song_id, deluxe, difficulty,
            count(score) AS play,
            count(score) FILTER (WHERE score >= 100) AS sss,
            count(score) FILTER (WHERE combo_flag <> '') AS fc,
            count(score) FILTER (WHERE combo_flag IN ('ap', 'ap+')) AS ap
        FROM dx_intl_public_scores
        WHERE score >= 0
        GROUP BY song_id, deluxe, difficulty
    )
    SELECT song_id, deluxe, difficulty,
        COALESCE(play, 0) AS play,
        COALESCE(sss::numeric / play, 0) AS sss_rate,
        COALESCE(fc::numeric / play, 0) AS fc_rate,
        COALESCE(ap::numeric / play, 0) AS ap_rate
    FROM st;
CREATE UNIQUE INDEX dx_intl_scores_rates_key ON dx_intl_scores_rates (song_id, deluxe, difficulty);

CREATE MATERIALIZED VIEW dx_intl_scores_histogram AS
    SELECT song_id, deluxe, difficulty,
        (floor(score * 2) / 2)::numeric(4, 1) AS score_bucket,
        count(*) AS count
    FROM dx_intl_public_scores
    WHERE difficulty >= 2
    GROUP BY song_id, deluxe, difficulty, (floor(score * 2) / 2)::numeric(4, 1);
CREATE UNIQUE INDEX dx_intl_scores_histogram_key ON dx_intl_scores_histogram (song_id, deluxe, difficulty, score_bucket);

CREATE MATERIALIZED VIEW dx_intl_score_per_rating_group AS
    WITH targets AS (SELECT generate_series(14000, 16500, 250) AS rating_target)
    SELECT t.rating_target, s.song_id, s.deluxe, s.difficulty, avg(s.score) AS average_score
    FROM dx_intl_public_scores s
    JOIN dx_intl_records r ON r.player_id = s.player_id
    JOIN targets t ON r.rating >= t.rating_target - 125 AND r.rating < t.rating_target + 125
    JOIN dx_intl_charts c ON c.song_id = s.song_id AND c.deluxe = s.deluxe AND c.difficulty = s.difficulty
    WHERE c.difficulty >= 2 AND s.score > 0
    GROUP BY t.rating_target, s.song_id, s.deluxe, s.difficulty;
CREATE UNIQUE INDEX dx_intl_score_per_rating_group_key ON dx_intl_score_per_rating_group (rating_target, song_id, deluxe, difficulty);

CREATE MATERIALIZED VIEW dx_intl_rating_target_stats AS
    WITH targets AS (
        SELECT generate_series(14000, 16500, 250) AS rating_target
    ), latest_release AS (
        -- the version in game now, and when it was released
        SELECT version, released_at
        FROM dx_intl_versions
        WHERE released_at <= now()
        ORDER BY version DESC
        LIMIT 1
    ), active_public_players AS (
        -- players who have imported since the latest release
        SELECT p.id AS player_id, r.rating
        FROM dx_intl_players p
        JOIN dx_intl_records r ON r.player_id = p.id
        CROSS JOIN latest_release lr
        WHERE p.private = false AND r.start > lr.released_at
    ), player_targets AS (
        SELECT app.player_id, t.rating_target
        FROM active_public_players app
        JOIN targets t ON app.rating >= t.rating_target - 125 AND app.rating < t.rating_target + 125
    ), player_song_ratings AS (
        SELECT pt.player_id, pt.rating_target, s.song_id, s.deluxe, s.difficulty, s.score,
            -- the rating's "new songs" frame (best 15): songs from the latest version
            -- and the one before it; every older song is in the best 35
            v.version >= lr.version - 1 AS current_version,
            dx_intl_get_rating(c.internal_lv, s.score, s.combo_flag IN ('ap', 'ap+')) AS song_rating
        FROM player_targets pt
        CROSS JOIN latest_release lr
        JOIN dx_intl_scores s ON s.player_id = pt.player_id
        JOIN dx_intl_charts c ON c.song_id = s.song_id AND c.deluxe = s.deluxe AND c.difficulty = s.difficulty
        JOIN dx_intl_variants v ON v.song_id = s.song_id AND v.deluxe = s.deluxe
        WHERE c.internal_lv IS NOT NULL
    ), ranked_songs AS (
        SELECT *, row_number() OVER (
            PARTITION BY player_id, rating_target, current_version
            ORDER BY song_rating DESC, score DESC, song_id, deluxe, difficulty
        ) AS rnk
        FROM player_song_ratings
    ), best_songs AS (
        SELECT rating_target, current_version, song_id, deluxe, difficulty, score
        FROM ranked_songs
        WHERE (current_version AND rnk <= 15) OR (NOT current_version AND rnk <= 35)
    ), aggregated AS (
        SELECT rating_target, current_version, song_id, deluxe, difficulty,
            count(*)::integer AS count, avg(score) AS average_score
        FROM best_songs
        GROUP BY rating_target, current_version, song_id, deluxe, difficulty
    ), ranked_agg AS (
        SELECT *, row_number() OVER (
            PARTITION BY rating_target, current_version
            ORDER BY count DESC, song_id, deluxe, difficulty
        ) AS rnk
        FROM aggregated
    )
    SELECT rating_target, current_version, song_id, deluxe, difficulty, count, average_score
    FROM ranked_agg
    WHERE (current_version AND rnk <= 15) OR (NOT current_version AND rnk <= 35)
    ORDER BY rating_target, current_version DESC, count DESC, song_id, deluxe, difficulty;
CREATE UNIQUE INDEX dx_intl_rating_target_stats_key
    ON dx_intl_rating_target_stats (rating_target, current_version, song_id, deluxe, difficulty);

-- ---------------------------------------------------------------------------
-- maimai FiNALE (archived, read-only data; history is static, not versioned)
-- ---------------------------------------------------------------------------

CREATE TABLE finale_songs (
    id smallint PRIMARY KEY,
    category smallint NOT NULL,
    title text NOT NULL,
    english_title text,
    "order" smallint NOT NULL,
    active boolean NOT NULL,
    japan_only boolean NOT NULL,
    version smallint NOT NULL
);

CREATE TABLE finale_charts (
    song_id smallint NOT NULL REFERENCES finale_songs (id) ON UPDATE CASCADE ON DELETE CASCADE,
    difficulty smallint NOT NULL,
    level finale_level NOT NULL,
    PRIMARY KEY (song_id, difficulty)
);

CREATE TABLE finale_players (
    id serial PRIMARY KEY,
    user_id text NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    nickname text NOT NULL UNIQUE
        CONSTRAINT finale_players_nickname_check CHECK (nickname <> 'new' AND nickname ~ '^[0-9a-z\-\_]{1,20}$'),
    "private" boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE finale_records (
    id serial PRIMARY KEY,
    player_id integer NOT NULL UNIQUE REFERENCES finale_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    card_name text NOT NULL,
    title text NOT NULL,
    rating numeric(4, 2) NOT NULL,
    max_rating numeric(4, 2) NOT NULL,
    class text NOT NULL,
    start timestamptz NOT NULL,
    "end" timestamptz NOT NULL
);

CREATE TABLE finale_records_history (
    id serial PRIMARY KEY,
    player_id integer NOT NULL REFERENCES finale_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    card_name text NOT NULL,
    title text NOT NULL,
    rating numeric(4, 2) NOT NULL,
    max_rating numeric(4, 2) NOT NULL,
    class text NOT NULL,
    start timestamptz NOT NULL,
    "end" timestamptz NOT NULL
);

CREATE TABLE finale_scores (
    id bigserial PRIMARY KEY,
    player_id integer NOT NULL REFERENCES finale_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    song_id smallint NOT NULL,
    difficulty smallint NOT NULL,
    score numeric(5, 2) NOT NULL,
    raw_score integer NOT NULL,
    combo_flag finale_combo_flag NOT NULL,
    sync_flag finale_sync_flag NOT NULL,
    start timestamptz NOT NULL,
    "end" timestamptz NOT NULL,
    UNIQUE (player_id, song_id, difficulty),
    FOREIGN KEY (song_id, difficulty) REFERENCES finale_charts (song_id, difficulty) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE finale_scores_history (
    id bigserial PRIMARY KEY,
    player_id integer NOT NULL REFERENCES finale_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    song_id smallint NOT NULL,
    difficulty smallint NOT NULL,
    score numeric(5, 2) NOT NULL,
    raw_score integer NOT NULL,
    combo_flag finale_combo_flag NOT NULL,
    sync_flag finale_sync_flag NOT NULL,
    start timestamptz NOT NULL,
    "end" timestamptz NOT NULL,
    FOREIGN KEY (song_id, difficulty) REFERENCES finale_charts (song_id, difficulty) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE VIEW finale_records_with_history AS
    SELECT * FROM finale_records
    UNION ALL
    SELECT * FROM finale_records_history;

CREATE VIEW finale_scores_with_history AS
    SELECT * FROM finale_scores
    UNION ALL
    SELECT * FROM finale_scores_history;

CREATE VIEW finale_players_timelines AS
    WITH make_it_read_only AS (SELECT 1)
    SELECT id, nickname, ARRAY(
        SELECT start FROM (
            SELECT start FROM finale_records WHERE player_id = p.id UNION ALL
            SELECT start FROM finale_records_history WHERE player_id = p.id UNION ALL
            SELECT DISTINCT start FROM finale_scores WHERE player_id = p.id UNION ALL
            SELECT DISTINCT start FROM finale_scores_history WHERE player_id = p.id
        ) AS q GROUP BY start ORDER BY start DESC
    ) AS timelines
    FROM finale_players p;

CREATE FUNCTION finale_players_updated_at(finale_players_row finale_players) RETURNS timestamptz
LANGUAGE sql STABLE AS $$
    SELECT greatest(record_start, score_start)
    FROM
        (SELECT start AS record_start FROM finale_records WHERE player_id = finale_players_row.id) r CROSS JOIN
        (SELECT MAX(start) AS score_start FROM finale_scores WHERE player_id = finale_players_row.id) s;
$$;
