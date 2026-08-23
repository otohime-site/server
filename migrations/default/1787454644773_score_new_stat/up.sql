CREATE MATERIALIZED VIEW dx_intl_scores_histogram AS
SELECT
  s.song_id,
  s.deluxe,
  s.difficulty,
  (FLOOR(s.score * 2) / 2)::numeric(4, 1) AS score_bucket,
  COUNT(*) AS count
FROM dx_intl_public_scores s
JOIN dx_intl_notes n
  ON n.song_id = s.song_id
 AND n.deluxe = s.deluxe
 AND n.difficulty = s.difficulty
WHERE n.difficulty >= 2
GROUP BY
  s.song_id,
  s.deluxe,
  s.difficulty,
  score_bucket;

CREATE UNIQUE INDEX ON dx_intl_scores_histogram
  (song_id, deluxe, difficulty, score_bucket);
