SELECT periods.drop_system_versioning('dx_intl_scores');
GRANT UPDATE ON TABLE dx_intl_scores_history TO CURRENT_USER;
UPDATE dx_intl_scores_history SET song_id = '19c1a9ab5da18fde0228e06eb33a889adf1cb6e71775593685975bf83f4b1a5c'
WHERE song_id = '37b114067456c07e82cafbb6dee4991bd74bc0d590179db68c31c4f90fb28dce';
SELECT periods.add_system_versioning('dx_intl_scores');
