DROP MATERIALIZED VIEW dx_intl_scores_stats;
DROP TYPE dx_intl_scores_stats_ranges;
DROP MATERIALIZED VIEW dx_intl_scores_rates;

CREATE VIEW dx_intl_scores_stats AS WITH range_table AS(
    SELECT unnest(
        array [
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
        ]
      ) AS score_range,
      unnest(
        array [
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
        ]
      ) AS description
  )
SELECT s.song_id,
  s.deluxe,
  s.difficulty,
  MIN(st.description) AS range,
  COUNT(s.score) AS count
FROM dx_intl_public_scores s
  INNER JOIN range_table st ON st.score_range @> s.score
GROUP BY s.song_id,
  s.deluxe,
  s.difficulty,
  st.score_range
ORDER BY st.score_range DESC;