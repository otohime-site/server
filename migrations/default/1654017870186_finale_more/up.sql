CREATE VIEW finale_players_timelines AS
    WITH make_it_read_only AS (SELECT 1)
    SELECT id, nickname, array(
        SELECT start FROM (
            SELECT start FROM finale_records WHERE player_id = p.id UNION ALL
            SELECT start FROM finale_records_history WHERE player_id = p.id UNION ALL
            SELECT DISTINCT start FROM finale_scores WHERE player_id = p.id UNION ALL
            SELECT DISTINCT start FROM finale_scores_history WHERE player_id = p.id
        ) AS q GROUP BY start ORDER BY start DESC
    ) AS timelines FROM finale_players p;