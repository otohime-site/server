CREATE TYPE dx_intl_trophy AS ENUM ('normal', 'bronze', 'silver', 'gold', 'rainbow');
CREATE TYPE dx_intl_level AS ENUM(
    '1', '2', '3', '4', '5', '6', '7', '7+', '8', '8+', '9', '9+', '10', '10+', '11', '11+',
    '12', '12+', '13', '13+', '14', '14+', '15'
);
CREATE TYPE dx_intl_combo_flag AS ENUM('', 'fc', 'fc+', 'ap', 'ap+');
CREATE TYPE dx_intl_sync_flag AS ENUM('', 'fs', 'fs+', 'fdx', 'fdx+');

CREATE TABLE dx_intl_songs (
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
    "version" SMALLINT NOT NULL CHECK (version >= 0 AND version <= 14),
    active boolean NOT NULL,
    PRIMARY KEY (song_id, deluxe)
);

CREATE TABLE dx_intl_notes (
    id SERIAL PRIMARY KEY,
    song_id integer,
    deluxe boolean NOT NULL,
    difficulty smallint NOT NULL CHECK (difficulty >= 0 AND difficulty <= 4),
    "level" dx_intl_level NOT NULL,
    FOREIGN KEY (song_id, deluxe) REFERENCES dx_intl_variants (song_id, deluxe)
    ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE (song_id, deluxe, difficulty)
);

CREATE TABLE dx_intl_players (
    id SERIAL PRIMARY KEY,
    user_id text NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    nickname text UNIQUE NOT NULL CHECK (nickname != 'new' AND nickname ~ '^[0-9a-z]{1,20}$'),
    "private" boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dx_intl_records (
    id SERIAL PRIMARY KEY,
    player_id integer NOT NULL UNIQUE REFERENCES dx_intl_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    card_name text NOT NULL,
    title text NOT NULL,
    trophy dx_intl_trophy NOT NUll,
    rating smallint NOT NULL CHECK (rating >=0 AND rating < 15000),
    max_rating smallint NOT NULL CHECK (max_rating >=0 AND max_rating < 15000 AND max_rating >= rating),
    grade integer NOT NULL CHECK (grade >= 1 AND grade <= 25)
);
SELECT periods.add_system_time_period('dx_intl_records', 'start', 'end');
SELECT periods.add_system_versioning('dx_intl_records');
CREATE INDEX ON dx_intl_records_history (player_id);

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
CREATE INDEX ON dx_intl_scores_history (player_id);

CREATE FUNCTION dx_intl_records_check_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $func$
BEGIN
    RETURN CASE WHEN OLD IS DISTINCT FROM NEW THEN NEW ELSE NULL END;
END;
$func$;

CREATE TRIGGER dx_intl_records_check_changed
BEFORE UPDATE ON dx_intl_records FOR EACH ROW
EXECUTE PROCEDURE dx_intl_records_check_changed();

CREATE FUNCTION dx_intl_scores_check_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $func$
BEGIN
    RETURN CASE WHEN OLD IS DISTINCT FROM NEW THEN NEW ELSE NULL END;
END;
$func$;

CREATE TRIGGER dx_intl_scores_check_changed
BEFORE UPDATE ON dx_intl_scores FOR EACH ROW
EXECUTE PROCEDURE dx_intl_scores_check_changed();

CREATE FUNCTION dx_intl_players_updated_at(dx_intl_players_row dx_intl_players)
RETURNS timestamptz AS $$
  SELECT greatest(record_start, score_start)
  FROM 
    (SELECT start AS record_start FROM dx_intl_records WHERE player_id = dx_intl_players_row.id) r CROSS JOIN
    (SELECT MAX(start) AS score_start FROM dx_intl_scores WHERE player_id = dx_intl_players_row.id) s;
$$ LANGUAGE sql STABLE;