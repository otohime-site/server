alter table "public"."dx_intl_variants" drop constraint "dx_intl_variants_version_check1";
alter table "public"."dx_intl_variants" add constraint "dx_intl_variants_version_check1" CHECK (version >= 0 AND version <= 21);

/* XXX: The following migration currently one-way only as it is hard to undo */
ALTER TYPE dx_intl_sync_flag ADD VALUE IF NOT EXISTS 's' BEFORE 'fs'; 