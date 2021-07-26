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