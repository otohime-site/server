alter table "public"."dx_intl_variants" drop constraint "dx_intl_variants_version_check1";
alter table "public"."dx_intl_variants" add constraint "dx_intl_variants_version_check1" CHECK (version >= 0 AND version <= 18);

alter table "public"."dx_intl_scores" drop constraint "dx_intl_scores_song_id_deluxe_difficulty_fkey";
alter table "public"."dx_intl_scores" add constraint "dx_intl_scores_song_id_deluxe_difficulty_fkey"
FOREIGN KEY (song_id, deluxe, difficulty) REFERENCES dx_intl_notes(song_id, deluxe, difficulty)
ON UPDATE CASCADE ON DELETE CASCADE;

SELECT periods.drop_system_versioning('dx_intl_scores');
SELECT periods.drop_system_time_period('dx_intl_scores');
GRANT UPDATE ON TABLE dx_intl_scores TO CURRENT_USER;
GRANT UPDATE ON TABLE dx_intl_scores_history TO CURRENT_USER;

UPDATE dx_intl_songs SET id = '19c1a9ab5da18fde0228e06eb33a889adf1cb6e71775593685975bf83f4b1a5c',
title = 'GIGANTØMAKHIA' WHERE id = '37b114067456c07e82cafbb6dee4991bd74bc0d590179db68c31c4f90fb28dce';
UPDATE dx_intl_scores_history SET song_id = '19c1a9ab5da18fde0228e06eb33a889adf1cb6e71775593685975bf83f4b1a5c'
WHERE song_id = '37b114067456c07e82cafbb6dee4991bd74bc0d590179db68c31c4f90fb28dce';

SELECT periods.add_system_time_period('public.dx_intl_scores', 'start', 'end');
SELECT periods.add_system_versioning('public.dx_intl_scores');