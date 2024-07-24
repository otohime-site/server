alter table "public"."dx_intl_variants" drop constraint "dx_intl_variants_version_check1";
alter table "public"."dx_intl_variants" add constraint "dx_intl_variants_version_check1" CHECK (version >= 0 AND version <= 21);

SELECT periods.drop_system_versioning('dx_intl_scores');
SELECT periods.drop_system_time_period('dx_intl_scores');
GRANT UPDATE ON TABLE dx_intl_scores TO CURRENT_USER;
GRANT UPDATE ON TABLE dx_intl_scores_history TO CURRENT_USER;

UPDATE dx_intl_songs SET id = 'a6789e3ebb8e2df50ec3746729a08b9a88dc16b42378f6207110df32f569044f',
category = 4 WHERE id = 'a7dbf5370d65b745fcf3fc7b76d1c1f71fe3e453eb03b27d24de9a47e7f5800a';
UPDATE dx_intl_scores_history SET song_id = 'a6789e3ebb8e2df50ec3746729a08b9a88dc16b42378f6207110df32f569044f'
WHERE song_id = 'a7dbf5370d65b745fcf3fc7b76d1c1f71fe3e453eb03b27d24de9a47e7f5800a';

SELECT periods.add_system_time_period('public.dx_intl_scores', 'start', 'end');
SELECT periods.add_system_versioning('public.dx_intl_scores');

REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_rates;