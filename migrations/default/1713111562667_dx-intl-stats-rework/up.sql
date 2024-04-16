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
DROP VIEW dx_intl_scores_stats;
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