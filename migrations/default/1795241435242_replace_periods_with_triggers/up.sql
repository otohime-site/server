-- Replace the `periods` extension's system versioning with plain PL/pgSQL triggers,
-- so the database no longer depends on a postgresql-NN-periods package.
-- Behaviour is kept identical: same columns, same history tables, same
-- *_with_history views (tracked by Hasura), same trigger names and firing order.
-- New: deleting a player removes its history at commit (step 6), so hooks no longer
-- need to detach versioning to clean up.

-- 1. Detach periods. purge => false keeps the history tables and their data;
--    periods still drops the *_with_history views and *__as_of/... functions.
SELECT periods.drop_system_versioning('dx_intl_records', purge => false);
SELECT periods.drop_system_time_period('dx_intl_records', purge => false);
SELECT periods.drop_system_versioning('dx_intl_scores', purge => false);
SELECT periods.drop_system_time_period('dx_intl_scores', purge => false);
-- Left in place: "start" DEFAULT transaction_timestamp(), "end" DEFAULT 'infinity',
-- and the CHECK (start < "end") constraints on the base tables.
-- periods also drops its CHECK ("end" = 'infinity') on the base tables; restore it.
ALTER TABLE dx_intl_records ADD CONSTRAINT dx_intl_records_end_infinity_check CHECK ("end" = 'infinity');
ALTER TABLE dx_intl_scores ADD CONSTRAINT dx_intl_scores_end_infinity_check CHECK ("end" = 'infinity');

-- 2. Trigger functions (generic, reusable by any table with start/"end" columns
--    and a <table>_history twin).
CREATE FUNCTION system_time_generated_always() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    -- Like periods' GENERATED ALWAYS: client-supplied values are ignored.
    NEW."start" := transaction_timestamp();
    NEW."end" := 'infinity';
    RETURN NEW;
END;
$func$;

CREATE FUNCTION system_time_write_history() RETURNS trigger
LANGUAGE plpgsql AS $func$
DECLARE
    history regclass := format('%I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME || '_history')::regclass;
BEGIN
    -- A row already written in this transaction gets no zero-length history row.
    IF OLD."start" < transaction_timestamp() THEN
        OLD."end" := transaction_timestamp();
        -- Map by column name, not position.
        EXECUTE format('INSERT INTO %s SELECT * FROM jsonb_populate_record(NULL::%s, $1)', history, history)
        USING to_jsonb(OLD);
    END IF;
    RETURN NULL;
END;
$func$;

CREATE FUNCTION system_time_truncate_history() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    EXECUTE format('TRUNCATE %I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME || '_history');
    RETURN NULL;
END;
$func$;

-- 3. Triggers. Names match the ones periods used, so BEFORE triggers still fire
--    alphabetically after *_check_changed (which drops no-op upserts).
CREATE TRIGGER dx_intl_records_system_time_generated_always
    BEFORE INSERT OR UPDATE ON dx_intl_records
    FOR EACH ROW EXECUTE FUNCTION system_time_generated_always();
CREATE TRIGGER dx_intl_records_system_time_write_history
    AFTER UPDATE OR DELETE ON dx_intl_records
    FOR EACH ROW EXECUTE FUNCTION system_time_write_history();
CREATE TRIGGER dx_intl_records_truncate
    AFTER TRUNCATE ON dx_intl_records
    FOR EACH STATEMENT EXECUTE FUNCTION system_time_truncate_history();

CREATE TRIGGER dx_intl_scores_system_time_generated_always
    BEFORE INSERT OR UPDATE ON dx_intl_scores
    FOR EACH ROW EXECUTE FUNCTION system_time_generated_always();
CREATE TRIGGER dx_intl_scores_system_time_write_history
    AFTER UPDATE OR DELETE ON dx_intl_scores
    FOR EACH ROW EXECUTE FUNCTION system_time_write_history();
CREATE TRIGGER dx_intl_scores_truncate
    AFTER TRUNCATE ON dx_intl_scores
    FOR EACH STATEMENT EXECUTE FUNCTION system_time_truncate_history();

-- 4. History rows are never changed, and only a deleted player's history may be removed
--    (step 6). periods left the tables SELECT-only for the owner.
REVOKE UPDATE, TRUNCATE ON dx_intl_records_history, dx_intl_scores_history FROM CURRENT_USER;
GRANT SELECT, INSERT, DELETE, TRIGGER ON dx_intl_records_history, dx_intl_scores_history TO CURRENT_USER;

CREATE FUNCTION dx_intl_history_require_deleted_player() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    IF EXISTS (SELECT 1 FROM dx_intl_players WHERE id = OLD.player_id) THEN
        RAISE EXCEPTION 'history of an existing player cannot be deleted'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
END;
$func$;

CREATE TRIGGER dx_intl_records_history_require_deleted_player
    BEFORE DELETE ON dx_intl_records_history
    FOR EACH ROW EXECUTE FUNCTION dx_intl_history_require_deleted_player();
CREATE TRIGGER dx_intl_scores_history_require_deleted_player
    BEFORE DELETE ON dx_intl_scores_history
    FOR EACH ROW EXECUTE FUNCTION dx_intl_history_require_deleted_player();
REVOKE TRIGGER ON dx_intl_records_history, dx_intl_scores_history FROM CURRENT_USER;

-- 5. Recreate the views periods dropped (same name and columns, so the Hasura
--    metadata in public_dx_intl_*_with_history.yaml keeps working unchanged).
CREATE VIEW dx_intl_records_with_history AS
    SELECT * FROM dx_intl_records
    UNION ALL
    SELECT * FROM dx_intl_records_history;
CREATE VIEW dx_intl_scores_with_history AS
    SELECT * FROM dx_intl_scores
    UNION ALL
    SELECT * FROM dx_intl_scores_history;

-- 6. A deleted player's history is removed when the deleting transaction commits
--    (this replaces the per-minute cleanup in hooks/src/cleanup.ts). The trigger is
--    deferred because the cascaded deletes of the player's records and scores write
--    their final history rows after a plain AFTER DELETE trigger on dx_intl_players
--    has already run.
CREATE FUNCTION dx_intl_players_purge_history() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    DELETE FROM dx_intl_records_history WHERE player_id = OLD.id;
    DELETE FROM dx_intl_scores_history WHERE player_id = OLD.id;
    RETURN NULL;
END;
$func$;

CREATE CONSTRAINT TRIGGER dx_intl_players_purge_history
    AFTER DELETE ON dx_intl_players
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION dx_intl_players_purge_history();

-- History of players deleted before this migration.
DELETE FROM dx_intl_records_history WHERE player_id NOT IN (SELECT id FROM dx_intl_players);
DELETE FROM dx_intl_scores_history WHERE player_id NOT IN (SELECT id FROM dx_intl_players);
