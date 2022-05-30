CREATE TYPE finale_level AS ENUM(
    '1', '2', '3', '4', '5', '6', '7', '7+',
    '8', '8+', '9', '9+', '10', '10+', '11', '11+',
    '12', '12+', '13', '13+', '14'
);
CREATE TYPE finale_combo_flag AS ENUM('', 'fc_silver', 'fc_gold', 'ap', 'ap_plus');
CREATE TYPE finale_sync_flag AS ENUM('', '100');


CREATE TABLE finale_songs (
    id smallint PRIMARY KEY,
    category smallint NOT NULL,
    title text NOT NULL,
    english_title text,
    "order" smallint NOT NULL,
    active boolean NOT NULL,
    japan_only boolean NOT NULL,
    "version" smallint NOT NULL
);

CREATE TABLE finale_notes (    
    song_id smallint NOT NULL
    REFERENCES finale_songs (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
    difficulty smallint NOT NULL,
    "level" finale_level NOT NULL,
    PRIMARY KEY (song_id, difficulty)
);

CREATE TABLE finale_players (
    id SERIAL PRIMARY KEY,
    user_id text NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    nickname text UNIQUE NOT NULL CHECK (nickname != 'new' AND nickname ~ '^[0-9a-z\-\_]{1,20}$'),
    "private" boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE finale_records (
    id SERIAL PRIMARY KEY,
    player_id integer NOT NULL UNIQUE REFERENCES finale_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    card_name text NOT NULL,
    title text NOT NULL,
    rating NUMERIC(4, 2) NOT NULL,
    max_rating NUMERIC(4, 2) NOT NULL,
    class text NOT NULL,
    start timestamp with time zone NOT NULL,
    "end" timestamp with time zone NOT NULL
);

CREATE TABLE finale_records_history (
    id SERIAL PRIMARY KEY,
    player_id integer NOT NULL UNIQUE REFERENCES finale_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    card_name text NOT NULL,
    title text NOT NULL,
    rating NUMERIC(4, 2) NOT NULL,
    max_rating NUMERIC(4, 2) NOT NULL,
    class text NOT NULL,
    start timestamp with time zone NOT NULL,
    "end" timestamp with time zone NOT NULL
);

CREATE VIEW finale_records_with_history AS
 SELECT finale_records.id,
    finale_records.player_id,
    finale_records.card_name,
    finale_records.title,
    finale_records.rating,
    finale_records.max_rating,
    finale_records.class,
    finale_records.start,
    finale_records."end"
   FROM finale_records
UNION ALL
 SELECT 
    finale_records_history.id,
    finale_records_history.player_id,
    finale_records_history.card_name,
    finale_records_history.title,
    finale_records_history.rating,
    finale_records_history.max_rating,
    finale_records_history.class,
    finale_records_history.start,
    finale_records_history."end"
   FROM finale_records_history;

CREATE TABLE finale_scores (
    id BIGSERIAL PRIMARY KEY,
    player_id integer NOT NULL UNIQUE REFERENCES finale_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    song_id SMALLINT NOT NULL,
    difficulty smallint NOT NULL,
    score numeric(5, 2) NOT NULL,
    raw_score INTEGER NOT NULL,
    combo_flag finale_combo_flag NOT NULL,
    sync_flag finale_sync_flag NOT NULL,
    FOREIGN KEY (song_id, difficulty) REFERENCES finale_notes (song_id, difficulty)
    ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE (player_id, song_id, difficulty),
    start timestamp with time zone NOT NULL,
    "end" timestamp with time zone NOT NULL
);

CREATE TABLE finale_scores_history (
    id BIGSERIAL PRIMARY KEY,
    player_id integer NOT NULL UNIQUE REFERENCES finale_players (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    song_id SMALLINT NOT NULL,
    difficulty smallint NOT NULL,
    score numeric(5, 2) NOT NULL,
    raw_score INTEGER NOT NULL,
    combo_flag finale_combo_flag NOT NULL,
    sync_flag finale_sync_flag NOT NULL,
    FOREIGN KEY (song_id, difficulty) REFERENCES finale_notes (song_id, difficulty)
    ON UPDATE CASCADE ON DELETE CASCADE,
    start timestamp with time zone NOT NULL,
    "end" timestamp with time zone NOT NULL
);

CREATE VIEW finale_scores_with_history AS
 SELECT finale_scores.id,
    finale_scores.player_id,
    finale_scores.song_id,
    finale_scores.difficulty,
    finale_scores.score,
    finale_scores.raw_score,
    finale_scores.combo_flag,
    finale_scores.sync_flag,
    finale_scores.start,
    finale_scores."end"
   FROM finale_scores
UNION ALL
 SELECT 
    finale_scores_history.id,
    finale_scores_history.player_id,
    finale_scores_history.song_id,
    finale_scores_history.difficulty,
    finale_scores_history.score,
    finale_scores_history.raw_score,
    finale_scores_history.combo_flag,
    finale_scores_history.sync_flag,
    finale_scores_history.start,
    finale_scores_history."end"
   FROM finale_scores_history;