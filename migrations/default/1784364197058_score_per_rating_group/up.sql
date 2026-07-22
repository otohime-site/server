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
