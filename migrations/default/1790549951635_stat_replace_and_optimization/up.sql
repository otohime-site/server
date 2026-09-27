-- dx_intl_scores_stats is superseded by dx_intl_scores_histogram: every range
-- boundary is a multiple of 0.5, so the histogram can reconstruct it.
DROP MATERIALIZED VIEW dx_intl_scores_stats;
DROP TYPE dx_intl_scores_stats_ranges;

-- The dx_intl_notes join was a pure existence check, already guaranteed by
-- the dx_intl_scores (song_id, deluxe, difficulty) foreign key.
DROP MATERIALIZED VIEW dx_intl_scores_histogram;
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
