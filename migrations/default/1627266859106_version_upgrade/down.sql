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