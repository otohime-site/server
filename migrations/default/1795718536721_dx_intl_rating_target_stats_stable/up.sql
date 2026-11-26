-- dx_intl_rating_target_stats could give different rows for the same data: both
-- row_number() windows ordered by values that can tie (song_rating/score, count),
-- so at the top-15/35 cutoffs which tied row survived depended on row order and
-- the query plan (a PG 16 and a PG 19 copy of the same data disagreed on about 10%
-- of the rows). The chart key is unique within each window partition, so adding it
-- makes the order total and the view deterministic. Nothing else changes.
--
-- Dropping the matview drops its Hasura tracking: run `metadata apply` afterwards
-- (the same as 1784737061545_version_upgrade).
DROP MATERIALIZED VIEW dx_intl_rating_target_stats;

CREATE MATERIALIZED VIEW dx_intl_rating_target_stats AS
    WITH targets AS (
        SELECT generate_series(14000, 16500, 250) AS rating_target
    ), active_public_players AS (
        SELECT p.id AS player_id, r.rating
        FROM dx_intl_players p
        JOIN dx_intl_records r ON r.player_id = p.id
        CROSS JOIN dx_intl_constants
        WHERE p.private = false AND r.start > dx_intl_constants.active_since
    ), player_targets AS (
        SELECT app.player_id, t.rating_target
        FROM active_public_players app
        JOIN targets t ON app.rating >= t.rating_target - 125 AND app.rating < t.rating_target + 125
    ), player_song_ratings AS (
        SELECT pt.player_id, pt.rating_target, s.song_id, s.deluxe, s.difficulty, s.score,
            v.version >= dx_intl_constants.current_version_threshold AS current_version,
            dx_intl_get_rating(c.internal_lv, s.score, s.combo_flag IN ('ap', 'ap+')) AS song_rating
        FROM player_targets pt
        CROSS JOIN dx_intl_constants
        JOIN dx_intl_scores s ON s.player_id = pt.player_id
        JOIN dx_intl_notes c ON c.song_id = s.song_id AND c.deluxe = s.deluxe AND c.difficulty = s.difficulty
        JOIN dx_intl_variants v ON v.song_id = s.song_id AND v.deluxe = s.deluxe
        WHERE c.internal_lv IS NOT NULL
    ), ranked_songs AS (
        SELECT *, row_number() OVER (
            PARTITION BY player_id, rating_target, current_version
            ORDER BY song_rating DESC, score DESC, song_id, deluxe, difficulty
        ) AS rnk
        FROM player_song_ratings
    ), best_songs AS (
        SELECT rating_target, current_version, song_id, deluxe, difficulty, score
        FROM ranked_songs
        WHERE (current_version AND rnk <= 15) OR (NOT current_version AND rnk <= 35)
    ), aggregated AS (
        SELECT rating_target, current_version, song_id, deluxe, difficulty,
            count(*)::integer AS count, avg(score) AS average_score
        FROM best_songs
        GROUP BY rating_target, current_version, song_id, deluxe, difficulty
    ), ranked_agg AS (
        SELECT *, row_number() OVER (
            PARTITION BY rating_target, current_version
            ORDER BY count DESC, song_id, deluxe, difficulty
        ) AS rnk
        FROM aggregated
    )
    SELECT rating_target, current_version, song_id, deluxe, difficulty, count, average_score
    FROM ranked_agg
    WHERE (current_version AND rnk <= 15) OR (NOT current_version AND rnk <= 35)
    ORDER BY rating_target, current_version DESC, count DESC, song_id, deluxe, difficulty;
CREATE UNIQUE INDEX dx_intl_rating_target_stats_key
    ON dx_intl_rating_target_stats (rating_target, current_version, song_id, deluxe, difficulty);
