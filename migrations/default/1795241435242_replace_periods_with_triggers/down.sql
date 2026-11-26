DROP TRIGGER dx_intl_players_purge_history ON dx_intl_players;
DROP FUNCTION dx_intl_players_purge_history();
DROP TRIGGER dx_intl_scores_history_require_deleted_player ON dx_intl_scores_history;
DROP TRIGGER dx_intl_records_history_require_deleted_player ON dx_intl_records_history;
DROP FUNCTION dx_intl_history_require_deleted_player();
-- the previous hooks/src/cleanup.ts grants DELETE itself while periods is detached
REVOKE DELETE ON dx_intl_records_history, dx_intl_scores_history FROM CURRENT_USER;

DROP VIEW dx_intl_scores_with_history;
DROP VIEW dx_intl_records_with_history;

DROP TRIGGER dx_intl_scores_truncate ON dx_intl_scores;
DROP TRIGGER dx_intl_scores_system_time_write_history ON dx_intl_scores;
DROP TRIGGER dx_intl_scores_system_time_generated_always ON dx_intl_scores;
DROP TRIGGER dx_intl_records_truncate ON dx_intl_records;
DROP TRIGGER dx_intl_records_system_time_write_history ON dx_intl_records;
DROP TRIGGER dx_intl_records_system_time_generated_always ON dx_intl_records;

DROP FUNCTION system_time_truncate_history();
DROP FUNCTION system_time_write_history();
DROP FUNCTION system_time_generated_always();

-- periods.add_system_versioning recreates these
ALTER TABLE dx_intl_records DROP CONSTRAINT dx_intl_records_end_infinity_check;
ALTER TABLE dx_intl_scores DROP CONSTRAINT dx_intl_scores_end_infinity_check;

SELECT periods.add_system_time_period('public.dx_intl_records', 'start', 'end');
SELECT periods.add_system_versioning('public.dx_intl_records');
SELECT periods.add_system_time_period('public.dx_intl_scores', 'start', 'end');
SELECT periods.add_system_versioning('public.dx_intl_scores');
