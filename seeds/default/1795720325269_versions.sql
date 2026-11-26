-- Release time of each maimai DX international version (04:00 JST).
-- Safe to apply on a fresh install and after transfer.sh (which already brings over
-- the current version from the old database): existing versions are left as they are.
INSERT INTO dx_intl_versions (version, released_at)
VALUES
    (25, '2026-01-22 19:00:00+00'), -- CiRCLE
    (26, '2026-07-22 19:00:00+00')  -- CiRCLE PLUS
ON CONFLICT (version) DO NOTHING;
