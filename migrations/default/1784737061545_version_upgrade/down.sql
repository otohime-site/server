alter table "public"."dx_intl_variants" drop constraint "dx_intl_variants_version_check1";
alter table "public"."dx_intl_variants" add constraint "dx_intl_variants_version_check1" CHECK (version >= 0 AND version <= 25);

-- Restore dx_intl_constants to a materialized view with its previous values.
DROP MATERIALIZED VIEW dx_intl_rating_target_stats;
DROP TABLE dx_intl_constants;

CREATE MATERIALIZED VIEW dx_intl_constants AS
SELECT
  TIMESTAMPTZ '2026-01-22 04:00:00+09' AS active_since,
  24                                    AS current_version_threshold;

CREATE MATERIALIZED VIEW dx_intl_rating_target_stats AS
WITH targets AS (
  -- Rating target buckets: 14000, 14250, ..., 16500
  SELECT generate_series(14000, 16500, 250) AS rating_target
),
active_public_players AS (
  -- Non-private players updated after active_since
  SELECT
    p.id AS player_id,
    r.rating
  FROM dx_intl_players p
  JOIN dx_intl_records r ON r.player_id = p.id
  CROSS JOIN dx_intl_constants
  WHERE p.private = false
    AND r.start > dx_intl_constants.active_since
),
player_targets AS (
  -- Match each player to their rating target bucket (rating +-125)
  SELECT
    app.player_id,
    t.rating_target
  FROM active_public_players app
  JOIN targets t
    ON app.rating >= (t.rating_target - 125)
   AND app.rating <  (t.rating_target + 125)
),
player_song_ratings AS (
  -- Compute per-song rating for every score a player has
  SELECT
    pt.player_id,
    pt.rating_target,
    s.song_id,
    s.deluxe,
    s.difficulty,
    s.score,
    (v.version >= dx_intl_constants.current_version_threshold) AS current_version,
    dx_intl_get_rating(
      n.internal_lv,
      s.score,
      s.combo_flag IN ('ap', 'ap+')
    ) AS song_rating
  FROM player_targets pt
  CROSS JOIN dx_intl_constants
  JOIN dx_intl_scores s
    ON s.player_id = pt.player_id
  JOIN dx_intl_notes n
    ON n.song_id = s.song_id AND n.deluxe = s.deluxe AND n.difficulty = s.difficulty
  JOIN dx_intl_variants v
    ON v.song_id = s.song_id AND v.deluxe = s.deluxe
  WHERE n.internal_lv IS NOT NULL
),
ranked_songs AS (
  -- Rank songs within each (player, rating_target, current_version) group
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY player_id, rating_target, current_version
      ORDER BY song_rating DESC, score DESC
    ) AS rnk
  FROM player_song_ratings
),
best_songs AS (
  -- Best 15 from current_version=true, best 35 from current_version=false
  SELECT
    rating_target,
    current_version,
    song_id,
    deluxe,
    difficulty,
    score
  FROM ranked_songs
  WHERE (current_version     AND rnk <= 15)
     OR (NOT current_version AND rnk <= 35)
),
aggregated AS (
  SELECT
    rating_target,
    current_version,
    song_id,
    deluxe,
    difficulty,
    COUNT(*)::integer  AS count,
    AVG(score)         AS average_score
  FROM best_songs
  GROUP BY rating_target, current_version, song_id, deluxe, difficulty
),
ranked_agg AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY rating_target, current_version
      ORDER BY count DESC
    ) AS rnk
  FROM aggregated
)
SELECT
  rating_target,
  current_version,
  song_id,
  deluxe,
  difficulty,
  count,
  average_score
FROM ranked_agg
WHERE (current_version     AND rnk <= 15)
   OR (NOT current_version AND rnk <= 35)
ORDER BY rating_target, current_version DESC, count DESC;

CREATE UNIQUE INDEX ON dx_intl_rating_target_stats
  (rating_target, current_version, song_id, deluxe, difficulty);
