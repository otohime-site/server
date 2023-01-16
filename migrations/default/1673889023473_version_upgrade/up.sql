alter table "public"."dx_intl_variants" drop constraint "dx_intl_variants_version_check1";
alter table "public"."dx_intl_variants" add constraint "dx_intl_variants_version_check1" CHECK (version >= 0 AND version <= 19);

alter table "public"."dx_intl_records" drop constraint "dx_intl_records_ranks_check";
alter table "public"."dx_intl_records" add constraint "dx_intl_records_ranks_check"
    CHECK ((
        course_rank IS NULL AND
        class_rank IS NULL AND
        grade IS NOT NULL AND (grade >= 1 AND grade <= 25)
    ) OR (
        course_rank IS NOT NULL AND course_rank >= 0 AND course_rank <= 23 AND course_rank != 11 AND
        class_rank IS NOT NULL AND class_rank >= 0 AND class_rank <= 25 AND
        grade IS NULL
    ));