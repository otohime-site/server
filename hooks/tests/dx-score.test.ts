// dx_score / max_dx_score on dx_intl_scores (see
// migrations/default/1795283713177_dx_intl_scores_dx_score). Needs
// TEST_DATABASE_URL, see tests/database.ts.
import assert from "node:assert/strict"
import { after, before, describe, test } from "node:test"
import type { Sql } from "postgres"

import { createDatabase, skip, type TestDatabase } from "./database.ts"

let db: TestDatabase
let sql: Sql
let players = 0

before(async () => {
  if (skip) return
  db = await createDatabase()
  sql = db.sql
  await sql`INSERT INTO dx_intl_songs (id, category, title, "order") VALUES ('song', 1, 'Song', 1)`
  await sql`INSERT INTO dx_intl_variants (song_id, deluxe, version, active) VALUES ('song', true, 1, true)`
  await sql`INSERT INTO dx_intl_charts (song_id, deluxe, difficulty, level) VALUES ('song', true, 3, '13')`
})
after(async () => {
  await db?.drop()
})

const newPlayer = async () => {
  const n = ++players
  await sql`INSERT INTO users (id) VALUES (${`user${n}`})`
  const [{ id }] = await sql<{ id: number }[]>`
    INSERT INTO dx_intl_players (user_id, nickname, private)
    VALUES (${`user${n}`}, ${`player${n}`}, false) RETURNING id`
  return id
}

interface Play {
  score: number
  dx: number | null
  max: number | null
  combo?: string
  song?: string
}

// The importer's upsert as the updated bookmarklet sends it.
const upsert = (playerId: number, p: Play) => sql`
  INSERT INTO dx_intl_scores (player_id, song_id, deluxe, difficulty, score, combo_flag, sync_flag, dx_score, max_dx_score)
  VALUES (${playerId}, ${p.song ?? "song"}, true, 3, ${p.score}, ${p.combo ?? ""}, '', ${p.dx}, ${p.max})
  ON CONFLICT ON CONSTRAINT dx_intl_scores_player_id_song_id_deluxe_difficulty_key DO UPDATE SET
    score = EXCLUDED.score, combo_flag = EXCLUDED.combo_flag, sync_flag = EXCLUDED.sync_flag,
    dx_score = EXCLUDED.dx_score, max_dx_score = EXCLUDED.max_dx_score`

// The upsert of a bookmarklet loaded before the deploy: no DX score columns.
const oldClientUpsert = (playerId: number, score: number) => sql`
  INSERT INTO dx_intl_scores (player_id, song_id, deluxe, difficulty, score, combo_flag, sync_flag)
  VALUES (${playerId}, 'song', true, 3, ${score}, '', '')
  ON CONFLICT ON CONSTRAINT dx_intl_scores_player_id_song_id_deluxe_difficulty_key DO UPDATE SET
    score = EXCLUDED.score, combo_flag = EXCLUDED.combo_flag, sync_flag = EXCLUDED.sync_flag`

/** A row imported before the migration: both DX score columns NULL. */
const legacyScore = async (playerId: number, score: number, song = "song") => {
  await sql.begin(async (tx) => {
    await tx`ALTER TABLE dx_intl_scores DISABLE TRIGGER dx_intl_scores_require_dx_score`
    await tx`
      INSERT INTO dx_intl_scores (player_id, song_id, deluxe, difficulty, score, combo_flag, sync_flag)
      VALUES (${playerId}, ${song}, true, 3, ${score}, '', '')`
    await tx`ALTER TABLE dx_intl_scores ENABLE TRIGGER dx_intl_scores_require_dx_score`
  })
}

const violates = (constraint: string) => (e: unknown) => {
  assert.equal((e as { constraint_name?: string }).constraint_name, constraint)
  return true
}
const requiresDxScore = /dx_score is required for new scores/

describe("DX score rules", { skip }, () => {
  for (const [name, play] of [
    [
      "a full DX score with 101%",
      { score: 101, dx: 3000, max: 3000, combo: "ap+" },
    ],
    [
      "101% without a full DX score",
      { score: 101, dx: 2990, max: 3000, combo: "ap+" },
    ],
    [
      "a DX score of 0 (played only before maimai DX)",
      { score: 97, dx: 0, max: 3000 },
    ],
  ] as const) {
    test(`accepts ${name}`, async () => {
      await upsert(await newPlayer(), play)
    })
  }

  for (const [name, play, constraint] of [
    [
      "only one of the two",
      { score: 99, dx: 100, max: null },
      "dx_intl_scores_dx_score_pair_check",
    ],
    [
      "a maximum that is not a multiple of 3",
      { score: 99, dx: 100, max: 3001 },
      "dx_intl_scores_max_dx_score_check",
    ],
    [
      "a maximum of 0",
      { score: 101, dx: 0, max: 0 },
      "dx_intl_scores_max_dx_score_check",
    ],
    [
      "a DX score above the maximum",
      { score: 99, dx: 3003, max: 3000 },
      "dx_intl_scores_dx_score_check",
    ],
    [
      "a negative DX score",
      { score: 99, dx: -3, max: 3000 },
      "dx_intl_scores_dx_score_check",
    ],
    [
      "a full DX score below 101%",
      { score: 100.5, dx: 3000, max: 3000 },
      "dx_intl_scores_dx_score_max_check",
    ],
  ] as const) {
    test(`rejects ${name}`, async () => {
      await assert.rejects(
        upsert(await newPlayer(), play),
        violates(constraint),
      )
    })
  }
})

describe("a DX score is required for new play results", { skip }, () => {
  test("inserting a score without it is rejected", async () => {
    await assert.rejects(
      upsert(await newPlayer(), { score: 99, dx: null, max: null }),
      requiresDxScore,
    )
  })

  test("a bookmarklet from before the deploy is rejected, even when nothing changed", async () => {
    const p = await newPlayer()
    await legacyScore(p, 99)
    await assert.rejects(oldClientUpsert(p, 99), requiresDxScore)
  })

  test("a legacy row gets its DX score, and history keeps the version without it", async () => {
    const p = await newPlayer()
    await legacyScore(p, 99)
    await upsert(p, { score: 99, dx: 2500, max: 3000 })
    const rows = await sql`
      SELECT dx_score FROM dx_intl_scores_with_history WHERE player_id = ${p} ORDER BY start`
    assert.deepEqual(
      rows.map((r) => r.dx_score),
      [null, 2500],
    )
  })

  test("a legacy row's play result cannot change without a DX score", async () => {
    const p = await newPlayer()
    await legacyScore(p, 99)
    await assert.rejects(
      sql`UPDATE dx_intl_scores SET score = 100 WHERE player_id = ${p}`,
      requiresDxScore,
    )
  })

  test("a legacy row follows a song id rename", async () => {
    const p = await newPlayer()
    await sql`INSERT INTO dx_intl_songs (id, category, title, "order") VALUES ('old', 1, 'Old', 2)`
    await sql`INSERT INTO dx_intl_variants (song_id, deluxe, version, active) VALUES ('old', true, 1, true)`
    await sql`INSERT INTO dx_intl_charts (song_id, deluxe, difficulty, level) VALUES ('old', true, 3, '13')`
    await legacyScore(p, 99, "old")
    await sql`UPDATE dx_intl_songs SET id = 'renamed' WHERE id = 'old'`
    const rows =
      await sql`SELECT song_id, dx_score FROM dx_intl_scores WHERE player_id = ${p}`
    assert.deepEqual([...rows], [{ song_id: "renamed", dx_score: null }])
  })

  test("a recorded DX score cannot be cleared", async () => {
    const p = await newPlayer()
    await upsert(p, { score: 99, dx: 2500, max: 3000 })
    await assert.rejects(
      upsert(p, { score: 99, dx: null, max: null }),
      requiresDxScore,
    )
  })

  test("history keeps the previous DX score", async () => {
    const p = await newPlayer()
    await upsert(p, { score: 99, dx: 2500, max: 3000 })
    await upsert(p, { score: 99, dx: 2600, max: 3000 })
    const rows = await sql`
      SELECT dx_score, max_dx_score FROM dx_intl_scores_history WHERE player_id = ${p}`
    assert.deepEqual([...rows], [{ dx_score: 2500, max_dx_score: 3000 }])
  })
})
