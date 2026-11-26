-- Store the DX score shown on the maimai DX NET record pages.
-- Rows imported before this migration have neither value (both NULL).
-- Requires 1795241435242_replace_periods_with_triggers: periods must no longer manage
-- dx_intl_scores when its columns change.

ALTER TABLE dx_intl_scores
    ADD COLUMN dx_score integer,
    ADD COLUMN max_dx_score integer,
    ADD CONSTRAINT dx_intl_scores_dx_score_pair_check
        CHECK ((dx_score IS NULL) = (max_dx_score IS NULL)),
    -- 3 points per note
    ADD CONSTRAINT dx_intl_scores_max_dx_score_check
        CHECK (max_dx_score > 0 AND max_dx_score % 3 = 0),
    -- 0 is valid: the chart was only played before maimai DX
    ADD CONSTRAINT dx_intl_scores_dx_score_check
        CHECK (dx_score >= 0 AND dx_score <= max_dx_score),
    -- A full DX score implies 101%; the reverse does not hold
    ADD CONSTRAINT dx_intl_scores_dx_score_max_check
        CHECK (dx_score <> max_dx_score OR score = 101.00);

-- Same columns in the same order: *_with_history is a positional UNION ALL, and
-- system_time_write_history maps by name, so it would silently drop the values if
-- the history table lacked these columns.
ALTER TABLE dx_intl_scores_history
    ADD COLUMN dx_score integer,
    ADD COLUMN max_dx_score integer;

-- SELECT * views froze their column lists. CREATE OR REPLACE may append columns, so
-- the materialized views built on dx_intl_public_scores stay in place.
CREATE OR REPLACE VIEW dx_intl_scores_with_history AS
    SELECT * FROM dx_intl_scores
    UNION ALL
    SELECT * FROM dx_intl_scores_history;
CREATE OR REPLACE VIEW dx_intl_public_scores AS
    SELECT s.* FROM dx_intl_scores s
    JOIN dx_intl_players p ON p.id = s.player_id
    WHERE p.private = false;

-- New data must carry dx_score: a chart is either absent (unplayed) or has both a score
-- and a DX score. A CHECK cannot tell old rows from new ones, and a NOT VALID CHECK
-- would still reject legacy rows on any UPDATE, including the ON UPDATE CASCADE from a
-- dx_intl_charts song_id rename. So the rule applies only when a row is inserted, when
-- its play result changes, or when dx_score would be cleared.
CREATE FUNCTION dx_intl_scores_require_dx_score() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
    IF NEW.dx_score IS NULL AND (
        TG_OP = 'INSERT'
        OR OLD.dx_score IS NOT NULL
        OR (NEW.score, NEW.combo_flag, NEW.sync_flag)
            IS DISTINCT FROM (OLD.score, OLD.combo_flag, OLD.sync_flag)
    ) THEN
        RAISE EXCEPTION 'dx_score is required for new scores'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$func$;

-- BEFORE triggers fire in name order: check_changed (drops no-op upserts first),
-- require_dx_score, then system_time_generated_always.
CREATE TRIGGER dx_intl_scores_require_dx_score
    BEFORE INSERT OR UPDATE ON dx_intl_scores
    FOR EACH ROW EXECUTE FUNCTION dx_intl_scores_require_dx_score();
