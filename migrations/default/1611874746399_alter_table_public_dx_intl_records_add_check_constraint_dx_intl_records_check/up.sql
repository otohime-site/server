alter table "public"."dx_intl_records" drop constraint "dx_intl_records_check";
alter table "public"."dx_intl_records" add constraint "dx_intl_records_check" check (max_rating = -1 OR (max_rating >= 0 AND max_rating < 15000 AND max_rating >= rating));
