DROP MATERIALIZED VIEW dx_intl_scores_histogram;
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

CREATE TYPE dx_intl_scores_stats_ranges AS enum (
  'AP+',
  'SSS+',
  'SSS',
  'SS+',
  'SS',
  'S+',
  'S',
  'AAA',
  'AA',
  'A',
  'D～BBB'
);
CREATE MATERIALIZED VIEW dx_intl_scores_stats AS
SELECT song_id,
  deluxe,
  difficulty,
  CASE
    WHEN score >= 101.0 THEN 'AP+'::dx_intl_scores_stats_ranges
    WHEN score >= 100.5 THEN 'SSS+'::dx_intl_scores_stats_ranges
    WHEN score >= 100.0 THEN 'SSS'::dx_intl_scores_stats_ranges
    WHEN score >= 99.5 THEN 'SS+'::dx_intl_scores_stats_ranges
    WHEN score >= 99.0 THEN 'SS'::dx_intl_scores_stats_ranges
    WHEN score >= 98.0 THEN 'S+'::dx_intl_scores_stats_ranges
    WHEN score >= 97.0 THEN 'S'::dx_intl_scores_stats_ranges
    WHEN score >= 94.0 THEN 'AAA'::dx_intl_scores_stats_ranges
    WHEN score >= 90.0 THEN 'AA'::dx_intl_scores_stats_ranges
    WHEN score >= 80.0 THEN 'A'::dx_intl_scores_stats_ranges
    ELSE 'D～BBB'::dx_intl_scores_stats_ranges
  END AS "range",
  count(score) as "count"
FROM dx_intl_public_scores s
WHERE score >= 0
GROUP BY song_id,
  deluxe,
  difficulty,
  "range"
ORDER BY "range" asc;
CREATE UNIQUE INDEX ON dx_intl_scores_stats (song_id, deluxe, difficulty, "range");
