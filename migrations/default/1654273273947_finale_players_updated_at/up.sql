CREATE FUNCTION finale_players_updated_at(finale_players_row finale_players)
RETURNS timestamptz AS $$
  SELECT greatest(record_start, score_start)
  FROM 
    (SELECT start AS record_start FROM finale_records WHERE player_id = finale_players_row.id) r CROSS JOIN
    (SELECT MAX(start) AS score_start FROM finale_scores WHERE player_id = finale_players_row.id) s;
$$ LANGUAGE sql STABLE;