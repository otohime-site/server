alter table "public"."dx_intl_variants" drop constraint "dx_intl_variants_version_check1";
alter table "public"."dx_intl_variants" add constraint "dx_intl_variants_version_check1" CHECK (version >= 0 AND version <= 24);

SELECT periods.drop_system_versioning('dx_intl_scores');
SELECT periods.drop_system_time_period('dx_intl_scores');
GRANT UPDATE ON TABLE dx_intl_scores TO CURRENT_USER;
GRANT UPDATE ON TABLE dx_intl_scores_history TO CURRENT_USER;

UPDATE dx_intl_songs SET id = 'f03c27010e7a0edc9ffba698d0c33481e6ef0a24a3dd3cad5b5b136d7ebd259e',
title = 'Help me, ERINNNNNN!!（Band ver.）' WHERE id = '9545c71fdbed4fbef1212e686ee4f2fd19f7eca4d1cd53321d5d112ba9bd48ab';
UPDATE dx_intl_scores_history SET song_id = 'f03c27010e7a0edc9ffba698d0c33481e6ef0a24a3dd3cad5b5b136d7ebd259e'
WHERE song_id = '9545c71fdbed4fbef1212e686ee4f2fd19f7eca4d1cd53321d5d112ba9bd48ab';

UPDATE dx_intl_songs SET id = 'f635155add1ee6fc702c5b42b4a79c7307c664432078b0bf82d927a2c209560c',
title = 'Bad Apple!! feat.nomico' WHERE id = '90e12ff39fdcf9b506582ead6e65fce2d57bc0aa39a1f0cfb0d0cdfbe9d5934c';
UPDATE dx_intl_scores_history SET song_id = 'f635155add1ee6fc702c5b42b4a79c7307c664432078b0bf82d927a2c209560c'
WHERE song_id = '90e12ff39fdcf9b506582ead6e65fce2d57bc0aa39a1f0cfb0d0cdfbe9d5934c';

SELECT periods.add_system_time_period('public.dx_intl_scores', 'start', 'end');
SELECT periods.add_system_versioning('public.dx_intl_scores');

REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY dx_intl_scores_rates;