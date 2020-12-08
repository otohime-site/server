CREATE INDEX dx_intl_players_nickname_idx ON dx_intl_players USING GIN (nickname gin_trgm_ops);

CREATE OR REPLACE FUNCTION dx_intl_get_base_rating(rating integer, grade integer)
RETURNS integer AS $$
    SELECT (rating - CASE
    WHEN grade = 2 THEN 250
    WHEN grade = 3 THEN 500
    WHEN grade = 4 THEN 750
    WHEN grade = 5 THEN 1000 
    WHEN grade = 6 THEN 1200
    WHEN grade = 7 THEN 1400
    WHEN grade = 8 THEN 1500
    WHEN grade = 9 THEN 1600
    WHEN grade = 10 THEN 1700
    WHEN grade = 11 THEN 1800
    WHEN grade = 12 THEN 1850
    WHEN grade = 13 THEN 1900
    WHEN grade = 14 THEN 1950
    WHEN grade = 15 THEN 2000
    WHEN grade = 16 THEN 2010
    WHEN grade = 17 THEN 2020
    WHEN grade = 18 THEN 2030
    WHEN grade = 19 THEN 2040 
    WHEN grade = 20 THEN 2050
    WHEN grade = 21 THEN 2060
    WHEN grade = 22 THEN 2070
    WHEN grade = 23 THEN 2080
    WHEN grade = 24 THEN 2090
    WHEN grade = 25 THEN 2100
    ELSE 0
    END)
$$ LANGUAGE sql STABLE;


CREATE OR REPLACE VIEW dx_intl_base_rating AS
    WITH range_table AS(
        SELECT
        rating_range,
        format('%s - %s', lower(rating_range), upper(rating_range) - 1) AS description
        FROM unnest(array[
            int4range(0, 1000),
            int4range(1000, 2000),
            int4range(2000, 3000),
            int4range(3000, 4000),
            int4range(4000, 5000),
            int4range(5000, 5500),
            int4range(5500, 6000),
            int4range(6000, 6500),
            int4range(6500, 7000),
            int4range(7000, 7500),
            int4range(7500, 8000),
            int4range(8000, NULL)
        ]) AS rating_range
    )
    SELECT MIN(rt.description) AS range, COUNT(r.base_rating) AS count FROM (
        SELECT (dx_intl_get_base_rating(rating, grade)) AS base_rating FROM dx_intl_public_records
    ) r
    INNER JOIN range_table rt ON rt.rating_range @> r.base_rating
    GROUP BY rt.rating_range ORDER BY rt.rating_range DESC;

CREATE OR REPLACE VIEW dx_intl_scores_stats AS
    WITH range_table AS(
        SELECT unnest(array[
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
        ]) AS score_range, unnest(array[
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
        ]) AS description
    )
    SELECT s.note_id, MIN(st.description) AS range, COUNT(s.score) AS count FROM dx_intl_public_scores s 
    INNER JOIN range_table st ON st.score_range @> s.score
    GROUP BY s.note_id, st.score_range ORDER BY st.score_range DESC;