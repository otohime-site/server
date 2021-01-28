alter table "public"."dx_intl_variants" drop constraint "dx_intl_variants_version_check";
alter table "public"."dx_intl_variants" add constraint "dx_intl_variants_version_check" check (CHECK (version >= 0 AND version <= 14));
