DROP VIEW dx_intl_base_rating;
DROP VIEW dx_intl_public_records;

alter table "public"."dx_intl_variants" drop constraint "dx_intl_variants_version_check1";
alter table "public"."dx_intl_variants" add constraint "dx_intl_variants_version_check1"
    CHECK (version >= 0 AND version <= 16);

SELECT periods.drop_system_versioning('dx_intl_records');

alter table "public"."dx_intl_records" drop constraint "dx_intl_records_grade_check";
alter table "public"."dx_intl_records" drop constraint "dx_intl_records_rating_check";

alter table "public"."dx_intl_records"
    alter column grade DROP NOT NULL,
    add column course_rank smallint,
    add column class_rank smallint,
    add column rating_legacy boolean not null default true;

alter table "public"."dx_intl_records_history"
    alter column grade DROP NOT NULL,
    add column course_rank smallint,
    add column class_rank smallint,
    add column rating_legacy boolean not null default true;

alter table "public"."dx_intl_records" add constraint "dx_intl_records_ranks_check"
    CHECK ((
        course_rank IS NULL AND
        class_rank IS NULL AND
        grade IS NOT NULL AND (grade >= 1 AND grade <= 25)
    ) OR (
        course_rank IS NOT NULL AND course_rank >= 0 AND course_rank <= 22 AND course_rank != 11 AND
        class_rank IS NOT NULL AND class_rank >= 0 AND class_rank <= 25 AND
        grade IS NULL
    ));
alter table "public"."dx_intl_records" add constraint "dx_intl_records_rating_check"
    CHECK (
        rating >= 0 AND rating <= 17000
    );
alter table "public"."dx_intl_records" add constraint "dx_intl_records_rating_legacy_check"
    CHECK (
        rating <= 10350 OR rating_legacy is false
    );

SELECT periods.add_system_versioning('dx_intl_records');

CREATE VIEW dx_intl_public_records AS
    SELECT r.* FROM dx_intl_records r
    INNER JOIN dx_intl_players p ON p.id = r.player_id
    WHERE p.private = false;

CREATE VIEW dx_intl_new_rating_stats AS
    WITH range_table AS(
        SELECT
        rating_range,
        format('%s - %s', lower(rating_range), upper(rating_range) - 1) AS description
        FROM unnest(array[
            int4range(4000, 7000),
            int4range(7000, 10000),
            int4range(10000, 12000),
            int4range(12000, 13000),
            int4range(13000, 14000),
            int4range(14000, 14500),
            int4range(14500, 15000),
            int4range(15000, 15500),
            int4range(15500, 16000),
            int4range(16000, NULL)
        ]) AS rating_range
    )
    SELECT MIN(rt.description) AS range, COUNT(r.rating) AS count FROM (
        SELECT rating FROM dx_intl_public_records
        WHERE dx_intl_public_records.rating_legacy IS false
    ) r
    INNER JOIN range_table rt ON rt.rating_range @> CAST(r.rating as integer)
    GROUP BY rt.rating_range ORDER BY rt.rating_range DESC;
