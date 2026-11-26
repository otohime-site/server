DROP TRIGGER dx_intl_scores_require_dx_score ON dx_intl_scores;
DROP FUNCTION dx_intl_scores_require_dx_score();

-- CREATE OR REPLACE VIEW cannot remove columns, so the views and the materialized
-- views built on dx_intl_public_scores are dropped and recreated without them.
DROP MATERIALIZED VIEW dx_intl_score_per_rating_group;
DROP MATERIALIZED VIEW dx_intl_scores_histogram;
DROP MATERIALIZED VIEW dx_intl_scores_rates;
DROP VIEW dx_intl_public_scores;
DROP VIEW dx_intl_scores_with_history;

ALTER TABLE dx_intl_scores_history
    DROP COLUMN dx_score,
    DROP COLUMN max_dx_score;
-- Dropping the columns also drops the CHECKs that use them.
ALTER TABLE dx_intl_scores
    DROP COLUMN dx_score,
    DROP COLUMN max_dx_score;

CREATE VIEW dx_intl_scores_with_history AS
    SELECT * FROM dx_intl_scores
    UNION ALL
    SELECT * FROM dx_intl_scores_history;
CREATE VIEW dx_intl_public_scores AS
    SELECT s.* FROM dx_intl_scores s
    JOIN dx_intl_players p ON p.id = s.player_id
    WHERE p.private = false;

-- Same definitions as 1790549951635_stat_replace_and_optimization
-- (1713111562667, 1784364197058, 1790549951635); index names are left to Postgres
-- as in those migrations, so they come back unchanged.
CREATE MATERIALIZED VIEW dx_intl_scores_rates AS WITH st AS (
  SELECT song_id,
    deluxe,
    difficulty,
    count(score) AS play,
    count(score) FILTER (
      WHERE score >= 100
    ) AS sss,
    count(score) FILTER (
      WHERE combo_flag != ''
    ) AS fc,
    count(score) FILTER (
      WHERE combo_flag IN ('ap', 'ap+')
    ) AS ap
  FROM dx_intl_public_scores
  WHERE score >= 0
  GROUP BY (song_id, deluxe, difficulty)
)
SELECT song_id,
  deluxe,
  difficulty,
  COALESCE(play, 0) AS play,
  COALESCE(sss / play::decimal, 0) AS sss_rate,
  COALESCE(fc / play::decimal, 0) AS fc_rate,
  COALESCE(ap / play::decimal, 0) AS ap_rate
FROM st;
CREATE UNIQUE INDEX ON dx_intl_scores_rates (song_id, deluxe, difficulty);

CREATE MATERIALIZED VIEW dx_intl_scores_histogram AS
SELECT
  song_id,
  deluxe,
  difficulty,
  (FLOOR(score * 2) / 2)::numeric(4, 1) AS score_bucket,
  COUNT(*) AS count
FROM dx_intl_public_scores
WHERE difficulty >= 2
GROUP BY
  song_id,
  deluxe,
  difficulty,
  score_bucket;
CREATE UNIQUE INDEX ON dx_intl_scores_histogram
  (song_id, deluxe, difficulty, score_bucket);

CREATE MATERIALIZED VIEW dx_intl_score_per_rating_group AS
WITH targets AS (
  SELECT generate_series(14000, 16500, 250) AS rating_target
)
SELECT
  t.rating_target,
  s.song_id,
  s.deluxe,
  s.difficulty,
  AVG(s.score) AS average_score
FROM dx_intl_public_scores s
JOIN dx_intl_records r ON r.player_id = s.player_id
JOIN targets t
  ON r.rating >= (t.rating_target - 125)
 AND r.rating <  (t.rating_target + 125)
JOIN dx_intl_notes n
  ON n.song_id = s.song_id
 AND n.deluxe = s.deluxe
 AND n.difficulty = s.difficulty
WHERE n.difficulty >= 2
  AND s.score > 0
GROUP BY t.rating_target, s.song_id, s.deluxe, s.difficulty;
CREATE UNIQUE INDEX ON dx_intl_score_per_rating_group
  (rating_target, song_id, deluxe, difficulty);
