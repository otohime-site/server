alter table "public"."dx_intl_variants" drop constraint "dx_intl_variants_version_check1";
alter table "public"."dx_intl_variants" add constraint "dx_intl_variants_version_check1" CHECK (version >= 0 AND version <= 18);

alter table "public"."dx_intl_scores" drop constraint "dx_intl_scores_song_id_deluxe_difficulty_fkey";
alter table "public"."dx_intl_scores" add constraint "dx_intl_scores_song_id_deluxe_difficulty_fkey"
FOREIGN KEY (song_id, deluxe, difficulty) REFERENCES dx_intl_notes(song_id, deluxe, difficulty)
ON UPDATE CASCADE ON DELETE CASCADE;

UPDATE dx_intl_songs SET id = '19c1a9ab5da18fde0228e06eb33a889adf1cb6e71775593685975bf83f4b1a5c',
title = 'GIGANTØMAKHIA' WHERE id = '37b114067456c07e82cafbb6dee4991bd74bc0d590179db68c31c4f90fb28dce';