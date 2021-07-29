DROP VIEW dx_intl_new_rating_stats;
DROP VIEW dx_intl_public_records;

alter table "public"."dx_intl_variants" drop constraint "dx_intl_variants_version_check1";
alter table "public"."dx_intl_variants" add constraint "dx_intl_variants_version_check1"
    CHECK (version >= 0 AND version <= 15);

SELECT periods.drop_system_versioning('dx_intl_records');

alter table "public"."dx_intl_records" drop constraint "dx_intl_records_ranks_check";
alter table "public"."dx_intl_records" drop constraint "dx_intl_records_rating_check";
alter table "public"."dx_intl_records" drop constraint "dx_intl_records_rating_legacy_check";

alter table "public"."dx_intl_records"
    alter column grade SET NOT NULL,
    drop column course_rank,
    drop column class_rank,
    drop column rating_legacy;

alter table "public"."dx_intl_records_history"
    alter column grade SET NOT NULL,
    drop column course_rank,
    drop column class_rank,
    drop column rating_legacy;

alter table "public"."dx_intl_records" add constraint "dx_intl_records_grade_check" CHECK (grade >= 1 AND grade <= 25);
alter table "public"."dx_intl_records" add constraint "dx_intl_records_rating_check" CHECK (rating >= 0 AND rating < 15000);

SELECT periods.add_system_versioning('dx_intl_records');

CREATE VIEW dx_intl_public_records AS
    SELECT r.* FROM dx_intl_records r
    INNER JOIN dx_intl_players p ON p.id = r.player_id
    WHERE p.private = false;

CREATE VIEW dx_intl_base_rating AS
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
        WHERE dx_intl_public_records.start >= '2021-01-28T22:00:00Z'
        AND dx_intl_public_records.start < '2021-07-29T22:00:00Z'
    ) r
    INNER JOIN range_table rt ON rt.rating_range @> r.base_rating
    GROUP BY rt.rating_range ORDER BY rt.rating_range DESC;