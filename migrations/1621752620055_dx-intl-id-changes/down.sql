SELECT periods.drop_system_versioning('dx_intl_scores');

/* Rename old tables */

ALTER TABLE dx_intl_songs RENAME TO dx_intl_songs_old;
ALTER TABLE dx_intl_variants RENAME TO dx_intl_variants_old;
ALTER TABLE dx_intl_notes RENAME TO dx_intl_notes_old;
ALTER TABLE dx_intl_scores RENAME TO dx_intl_scores_old;
ALTER TABLE dx_intl_scores_history RENAME TO dx_intl_scores_history_old;

/* Create new tables */

CREATE TABLE dx_intl_songs (
    old_id varchar(64) UNIQUE,
    id SERIAL PRIMARY KEY,
    category smallint NOT NULL CHECK (category >= 1 AND category <= 6),
    title TEXT NOT NULL,
    "order" smallint NOT NULL CHECK ("order" >= 1),
    UNIQUE (category, title)
);

CREATE INDEX on dx_intl_songs (category, "order");

CREATE TABLE dx_intl_variants (
    song_id integer REFERENCES dx_intl_songs (id) ON UPDATE CASCADE ON DELETE CASCADE,
    deluxe boolean NOT NULL,
    "version" SMALLINT NOT NULL CHECK (version >= 0 AND version <= 15),
    active boolean NOT NULL,
    PRIMARY KEY (song_id, deluxe)
);

CREATE TABLE dx_intl_notes (
    old_song_id varchar(64) UNIQUE,
    id SERIAL PRIMARY KEY,
    song_id integer,
    deluxe boolean NOT NULL,
    difficulty smallint NOT NULL CHECK (difficulty >= 0 AND difficulty <= 4),
    "level" dx_intl_level NOT NULL,
    FOREIGN KEY (song_id, deluxe) REFERENCES dx_intl_variants (song_id, deluxe)
    ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE (song_id, deluxe, difficulty)
);

CREATE TABLE dx_intl_scores (
    id BIGSERIAL PRIMARY KEY,
    player_id integer NOT NULL REFERENCES dx_intl_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    note_id integer NOT NULL REFERENCES dx_intl_notes (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    score numeric(7, 4) NOT NULL CHECK (score >= 0 AND score <= 101.00),
    combo_flag dx_intl_combo_flag NOT NULL CHECK (combo_flag != 'ap+' OR score = 101.00),
    sync_flag dx_intl_sync_flag NOT NULL CHECK (sync_flag != 'fdx+' OR combo_flag = 'ap' OR combo_flag = 'ap+'),
    UNIQUE (player_id, note_id)
);
SELECT periods.add_system_time_period('dx_intl_scores', 'start', 'end');
SELECT periods.add_system_versioning('dx_intl_scores');
SELECT periods.drop_system_versioning('dx_intl_scores');
GRANT INSERT ON dx_intl_scores_history TO CURRENT_USER;
CREATE INDEX ON dx_intl_scores_history (player_id);

/* Copy data into new */

INSERT INTO dx_intl_songs (old_id, category, title, "order") SELECT
    id,
    category, title, "order" FROM dx_intl_songs_old;

INSERT INTO dx_intl_variants (song_id, deluxe, "version", active) SELECT
    song.id,
    old.deluxe,
    old."version",
    old.active
    FROM dx_intl_variants_old AS old
    JOIN dx_intl_songs AS song ON song.old_id = old.song_id;

INSERT INTO dx_intl_notes (
    song_id, deluxe, difficulty, "level"
    ) SELECT
    song.id,
    old.deluxe,
    old.difficulty,
    old."level"
    FROM dx_intl_notes_old AS old
    JOIN dx_intl_songs AS song ON song.old_id = old.song_id;

INSERT INTO dx_intl_scores (
    id, player_id, note_id, score, combo_flag, sync_flag, "start", "end"
    ) SELECT
    old.id,
    old.player_id,
    note.id,
    old.score,
    old.combo_flag,
    old.sync_flag,
    old.start,
    old.end 
    FROM dx_intl_scores_old AS old
    JOIN dx_intl_notes AS note ON note.old_song_id = old.song_id AND note.deluxe = old.deluxe AND note.difficulty = old.difficulty;

INSERT INTO dx_intl_scores_history (
    id, player_id, note_id, score, combo_flag, sync_flag, "start", "end"
    ) SELECT
    old.id,
    old.player_id,
    note.id,
    old.score,
    old.combo_flag,
    old.sync_flag,
    old.start,
    old.end 
    FROM dx_intl_scores_history_old AS old
    JOIN dx_intl_notes AS note ON note.old_song_id = old.song_id and note.deluxe = old.deluxe and note.difficulty = old.difficulty;

SELECT periods.add_system_versioning('dx_intl_scores');

/* Replace views */
DROP VIEW dx_intl_players_timelines;
CREATE VIEW dx_intl_players_timelines AS
    WITH make_it_read_only AS (SELECT 1)
    SELECT id, nickname, array(
        SELECT start FROM (
            SELECT start FROM dx_intl_records WHERE player_id = p.id UNION ALL
            SELECT start FROM dx_intl_records_history WHERE player_id = p.id UNION ALL
            SELECT DISTINCT start FROM dx_intl_scores WHERE player_id = p.id UNION ALL
            SELECT DISTINCT start FROM dx_intl_scores_history WHERE player_id = p.id
        ) AS q GROUP BY start ORDER BY start DESC
    ) AS timelines FROM dx_intl_players p;

DROP VIEW dx_intl_scores_stats;
DROP VIEW dx_intl_base_rating;
DROP VIEW dx_intl_public_scores;
DROP VIEW dx_intl_public_records;

CREATE VIEW dx_intl_public_records AS
    SELECT r.* FROM dx_intl_records r
    INNER JOIN dx_intl_players p ON p.id = r.player_id
    WHERE p.private = false;;

CREATE VIEW dx_intl_public_scores AS
    SELECT s.* FROM dx_intl_scores s
    INNER JOIN dx_intl_players p ON p.id = s.player_id
    WHERE p.private = false;

CREATE VIEW dx_intl_base_rating AS
    WITH range_table AS(
        SELECT
        rating_range,
        format('%s - %s', lower(rating_range), upper(rating_range) - 1) AS description
        FROM unnest(array[
            int4range(0, 1000),
            int4range(1000, 2000),
            int4range(2000, 3000),
            int4range(3000, 4000),
            int4range(4000, 5000),
            int4range(5000, 5500),
            int4range(5500, 6000),
            int4range(6000, 6500),
            int4range(6500, 7000),
            int4range(7000, 7500),
            int4range(7500, 8000),
            int4range(8000, NULL)
        ]) AS rating_range
    )
    SELECT MIN(rt.description) AS range, COUNT(r.base_rating) AS count FROM (
        SELECT (dx_intl_get_base_rating(rating, grade)) AS base_rating FROM dx_intl_public_records
    ) r
    INNER JOIN range_table rt ON rt.rating_range @> r.base_rating
    GROUP BY rt.rating_range ORDER BY rt.rating_range DESC;

CREATE VIEW dx_intl_scores_stats AS
    WITH range_table AS(
        SELECT unnest(array[
            numrange(0.0, 80.0),
            numrange(80.0, 90.0),
            numrange(90.0, 94.0),
            numrange(94.0, 97.0),
            numrange(97.0, 98.0),
            numrange(98.0, 99.0),
            numrange(99.0, 99.5),
            numrange(99.5, 100.0),
            numrange(100.0, 100.5),
            numrange(100.5, 101.0),
            numrange(101.0, NULL)
        ]) AS score_range, unnest(array[
            'D～BBB',
            'A',
            'AA',
            'AAA',
            'S',
            'S+',
            'SS',
            'SS+',
            'SSS',
            'SSS+',
            'AP+'
        ]) AS description
    )
    SELECT s.note_id, MIN(st.description) AS range, COUNT(s.score) AS count FROM dx_intl_public_scores s 
    INNER JOIN range_table st ON st.score_range @> s.score
    GROUP BY s.note_id, st.score_range ORDER BY st.score_range DESC;


/* Drop columns */
ALTER TABLE dx_intl_songs DROP COLUMN old_id;
ALTER TABLE dx_intl_notes DROP COLUMN old_song_id;

/* Drop old tables */
DROP TABLE dx_intl_scores_old;
DROP TABLE dx_intl_scores_history_old;
DROP TABLE dx_intl_notes_old;
DROP TABLE dx_intl_variants_old;
DROP TABLE dx_intl_songs_old;