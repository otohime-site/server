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

CREATE TABLE dx_intl_notes (
    id SERIAL PRIMARY KEY,
    song_id integer REFERENCES dx_intl_songs (id) ON UPDATE CASCADE ON DELETE CASCADE,
    deluxe boolean NOT NULL,
    active boolean NOT NULL,
    levels dx_intl_level[] CHECK (array_length(levels, 1) IN (4, 5)),
    version SMALLINT NOT NULL CHECK (version >= 0 AND version <= 14),
    UNIQUE (song_id, deluxe)
);

CREATE TABLE dx_intl_players (
    id SERIAL PRIMARY KEY,
    user_id text NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    nickname text UNIQUE NOT NULL CHECK (nickname ~ '^[0-9a-z]{1,20}$'),
    "private" boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dx_intl_records (
    id SERIAL PRIMARY KEY,
    player_id integer NOT NULL UNIQUE REFERENCES dx_intl_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    card_name text NOT NULL,
    title text NOT NULL,
    trophy dx_intl_trophy NOT NUll,
    rating smallint CHECK (rating >=0 AND rating < 15000),
    max_rating smallint CHECK (max_rating >=0 AND max_rating < 15000 AND max_rating >= rating),
    grade integer CHECK (grade >= 1 AND grade <= 25)
);
SELECT periods.add_system_time_period('dx_intl_records', 'start', 'end');
SELECT periods.add_system_versioning('dx_intl_records');

CREATE TABLE dx_intl_scores (
    id BIGSERIAL PRIMARY KEY,
    player_id integer NOT NULL REFERENCES dx_intl_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    note_id integer NOT NULL REFERENCES dx_intl_notes (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    difficulty smallint NOT NULL CHECK (difficulty >= 0 AND difficulty <= 4),
    score numeric(7) NOT NULL CHECK (score >= 0 AND score <= 101.00),
    combo_flag dx_intl_combo_flag NOT NULL CHECK (combo_flag != 'ap+' OR score = 101.00),
    sync_flag dx_intl_sync_flag NOT NULL CHECK (sync_flag != 'fdx+' OR combo_flag = 'ap' OR combo_flag = 'ap+'),
    UNIQUE (player_id, note_id, difficulty)
);
SELECT periods.add_system_time_period('dx_intl_scores', 'start', 'end');
SELECT periods.add_system_versioning('dx_intl_scores');

CREATE FUNCTION dx_intl_delete_player_cleanup() RETURNS TRIGGER LANGUAGE plpgsql AS $func$
BEGIN
    PERFORM periods.drop_system_versioning('dx_intl_records');
    PERFORM periods.drop_system_versioning('dx_intl_scores');
    GRANT DELETE ON TABLE dx_intl_records_history TO CURRENT_USER;
    GRANT DELETE ON TABLE dx_intl_scores_history TO CURRENT_USER;
    DELETE FROM dx_intl_records WHERE player_id = OLD.id;
    DELETE FROM dx_intl_records_history WHERE player_id = OLD.id;
    DELETE FROM dx_intl_scores WHERE player_id = OLD.id;
    DELETE FROM dx_intl_scores_history WHERE player_id = OLD.id;
    PERFORM periods.add_system_versioning('dx_intl_records');
    PERFORM periods.add_system_versioning('dx_intl_scores');
    RETURN OLD;
END;
$func$;

CREATE TRIGGER dx_intl_delete_player_cleanup AFTER DELETE ON dx_intl_players FOR EACH ROW
EXECUTE PROCEDURE dx_intl_delete_player_cleanup();

CREATE FUNCTION dx_intl_delete_note_cleanup() RETURNS TRIGGER LANGUAGE plpgsql AS $func$
BEGIN
    PERFORM periods.drop_system_versioning('dx_intl_scores');
    GRANT DELETE ON TABLE dx_intl_scores_history TO CURRENT_USER;
    DELETE FROM dx_intl_scores WHERE note_id = OLD.id;
    DELETE FROM dx_intl_scores_history WHERE note_id = OLD.id;
    PERFORM periods.add_system_versioning('dx_intl_scores');
    RETURN OLD;
END;
$func$;

CREATE TRIGGER dx_intl_delete_note_cleanup AFTER DELETE ON dx_intl_notes FOR EACH ROW
EXECUTE PROCEDURE dx_intl_delete_note_cleanup();