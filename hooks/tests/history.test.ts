// System versioning of dx_intl_records / dx_intl_scores (trigger-based, see
// migrations/default/1795241435242_replace_periods_with_triggers) and the removal
// of a deleted player's history. Needs TEST_DATABASE_URL, see tests/database.ts.
import assert from "node:assert/strict"
import { after, before, describe, test } from "node:test"
import type { Sql, TransactionSql } from "postgres"

import { createDatabase, skip, type TestDatabase } from "./database.ts"

let db: TestDatabase
let sql: Sql
let players = 0

/** A connection or a transaction. */
type Q = Sql | TransactionSql

before(async () => {
  if (skip) return
  db = await createDatabase()
  sql = db.sql
  await sql`INSERT INTO dx_intl_songs (id, category, title, "order") VALUES ('song', 1, 'Song', 1)`
  await sql`INSERT INTO dx_intl_variants (song_id, deluxe, version, active) VALUES ('song', true, 1, true)`
  await sql`
    INSERT INTO dx_intl_notes (song_id, deluxe, difficulty, level, internal_lv)
    VALUES ('song', true, 3, '13', 13.0), ('song', true, 4, '14', 14.0)`
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

// The statements Hasura generates for the importer's upserts.
const upsertRecord = (q: Q, playerId: number, rating: number) => q`
  INSERT INTO dx_intl_records (player_id, card_name, title, trophy, rating, max_rating, grade)
  VALUES (${playerId}, 'card', 'title', 'normal', ${rating}, ${rating}, 1)
  ON CONFLICT ON CONSTRAINT dx_intl_records_player_id_key DO UPDATE SET
    card_name = EXCLUDED.card_name, title = EXCLUDED.title, trophy = EXCLUDED.trophy,
    rating = EXCLUDED.rating, max_rating = EXCLUDED.max_rating, grade = EXCLUDED.grade`

const upsertScore = (
  q: Q,
  playerId: number,
  score: number,
  difficulty = 3,
) => q`
  INSERT INTO dx_intl_scores (player_id, song_id, deluxe, difficulty, score, combo_flag, sync_flag, dx_score, max_dx_score)
  VALUES (${playerId}, 'song', true, ${difficulty}, ${score}, '', '', ${Math.round(score * 10)}, 3000)
  ON CONFLICT ON CONSTRAINT dx_intl_scores_player_id_song_id_deluxe_difficulty_key DO UPDATE SET
    score = EXCLUDED.score, combo_flag = EXCLUDED.combo_flag, sync_flag = EXCLUDED.sync_flag,
    dx_score = EXCLUDED.dx_score, max_dx_score = EXCLUDED.max_dx_score`

const historyCount = async (playerId: number) => {
  const [{ records, scores }] = await sql<
    { records: number; scores: number }[]
  >`
    SELECT (SELECT count(*)::int FROM dx_intl_records_history WHERE player_id = ${playerId}) AS records,
           (SELECT count(*)::int FROM dx_intl_scores_history WHERE player_id = ${playerId}) AS scores`
  return { records, scores }
}

describe("system versioning", { skip }, () => {
  test("a change in a later transaction moves the old version to history", async () => {
    const p = await newPlayer()
    await upsertRecord(sql, p, 1000)
    await upsertRecord(sql, p, 1100)
    // Timestamps are compared in SQL: JavaScript dates drop the microseconds.
    const rows = await sql`
      SELECT h.rating, h."end" = r.start AS chained, r.rating AS current
      FROM dx_intl_records_history h JOIN dx_intl_records r USING (player_id)
      WHERE player_id = ${p}`
    assert.deepEqual(
      [...rows],
      [{ rating: 1000, chained: true, current: 1100 }],
    )
  })

  test("an unchanged upsert writes no history and keeps start", async () => {
    const p = await newPlayer()
    await upsertRecord(sql, p, 1000)
    const [before] =
      await sql`SELECT start::text FROM dx_intl_records WHERE player_id = ${p}`
    await upsertRecord(sql, p, 1000)
    const [after] =
      await sql`SELECT start::text FROM dx_intl_records WHERE player_id = ${p}`
    assert.equal(after.start, before.start)
    assert.deepEqual(await historyCount(p), { records: 0, scores: 0 })
  })

  test("several updates in one transaction write one history row", async () => {
    const p = await newPlayer()
    await upsertRecord(sql, p, 1000)
    await sql.begin(async (tx) => {
      await upsertRecord(tx, p, 1100)
      await upsertRecord(tx, p, 1200)
    })
    const rows =
      await sql`SELECT rating FROM dx_intl_records_with_history WHERE player_id = ${p} ORDER BY start`
    assert.deepEqual(
      rows.map((r) => r.rating),
      [1000, 1200],
    )
  })

  test("a row inserted and changed in one transaction has no history", async () => {
    const p = await newPlayer()
    await sql.begin(async (tx) => {
      await upsertRecord(tx, p, 1000)
      await upsertRecord(tx, p, 1100)
    })
    assert.deepEqual(await historyCount(p), { records: 0, scores: 0 })
  })

  test("start and end sent by a client are ignored", async () => {
    const p = await newPlayer()
    const forged = await sql.begin(async (tx) => {
      await tx`
        INSERT INTO dx_intl_records (player_id, card_name, title, trophy, rating, max_rating, grade, start, "end")
        VALUES (${p}, 'card', 'title', 'normal', 1000, 1000, 1, '2000-01-01', '2001-01-01')`
      const [inserted] = await tx`
        SELECT start = transaction_timestamp() AS start_now, "end" = 'infinity' AS end_infinity
        FROM dx_intl_records WHERE player_id = ${p}`
      return inserted
    })
    assert.deepEqual(forged, { start_now: true, end_infinity: true })
    const updated = await sql.begin(async (tx) => {
      await tx`UPDATE dx_intl_records SET rating = 1100, max_rating = 1100, start = '2000-01-01' WHERE player_id = ${p}`
      const [row] =
        await tx`SELECT start = transaction_timestamp() AS start_now FROM dx_intl_records WHERE player_id = ${p}`
      return row
    })
    assert.deepEqual(updated, { start_now: true })
  })

  test("deleting a row moves its last version to history", async () => {
    const p = await newPlayer()
    await upsertScore(sql, p, 99)
    await sql`DELETE FROM dx_intl_scores WHERE player_id = ${p}`
    const rows =
      await sql`SELECT score::text, "end" < 'infinity' AS closed FROM dx_intl_scores_history WHERE player_id = ${p}`
    assert.deepEqual([...rows], [{ score: "99.0000", closed: true }])
  })

  test("the history row keeps every column of the old version", async () => {
    const p = await newPlayer()
    await upsertScore(sql, p, 99)
    const [old] =
      await sql`SELECT to_jsonb(s) - 'end' AS row FROM dx_intl_scores s WHERE player_id = ${p}`
    await upsertScore(sql, p, 100)
    const [kept] =
      await sql`SELECT to_jsonb(h) - 'end' AS row FROM dx_intl_scores_history h WHERE player_id = ${p}`
    assert.deepEqual(kept.row, old.row)
  })

  test("history cannot be changed, and a live player's history cannot be deleted", async () => {
    const p = await newPlayer()
    await upsertScore(sql, p, 99)
    await upsertScore(sql, p, 100)
    await assert.rejects(
      sql`UPDATE dx_intl_scores_history SET score = 0 WHERE player_id = ${p}`,
      /permission denied/,
    )
    await assert.rejects(
      sql`TRUNCATE dx_intl_scores_history`,
      /permission denied/,
    )
    await assert.rejects(
      sql`DELETE FROM dx_intl_scores_history WHERE player_id = ${p}`,
      /history of an existing player cannot be deleted/,
    )
    // TRUNCATE of the table itself would also truncate its history, so it is refused too.
    await assert.rejects(sql`TRUNCATE dx_intl_scores`, /permission denied/)
    assert.deepEqual(await historyCount(p), { records: 0, scores: 1 })
  })
})

describe("deleting a player", { skip }, () => {
  const withHistory = async () => {
    const p = await newPlayer()
    await upsertRecord(sql, p, 1000)
    await upsertScore(sql, p, 99)
    await upsertScore(sql, p, 98, 4)
    await upsertRecord(sql, p, 1100)
    await upsertScore(sql, p, 100)
    await upsertScore(sql, p, 99, 4)
    assert.deepEqual(await historyCount(p), { records: 1, scores: 2 })
    return p
  }

  test("removes its history, including the final versions, at commit", async () => {
    const p = await withHistory()
    const other = await withHistory()
    const inside = await sql.begin(async (tx) => {
      await tx`DELETE FROM dx_intl_players WHERE id = ${p}`
      const [{ n }] =
        await tx`SELECT count(*)::int AS n FROM dx_intl_scores_history WHERE player_id = ${p}`
      return n
    })
    assert.equal(
      inside,
      4,
      "the cascade wrote the 2 final versions; removal waits for commit",
    )
    assert.deepEqual(await historyCount(p), { records: 0, scores: 0 })
    assert.deepEqual(await historyCount(other), { records: 1, scores: 2 })
  })

  test("removes its history when the user is deleted", async () => {
    const p = await withHistory()
    const [{ user_id }] =
      await sql`SELECT user_id FROM dx_intl_players WHERE id = ${p}`
    await sql`DELETE FROM users WHERE id = ${user_id}`
    assert.deepEqual(await historyCount(p), { records: 0, scores: 0 })
  })

  test("removes history written earlier in the same transaction", async () => {
    const p = await withHistory()
    await sql.begin(async (tx) => {
      await upsertScore(tx, p, 101)
      await tx`DELETE FROM dx_intl_players WHERE id = ${p}`
    })
    assert.deepEqual(await historyCount(p), { records: 0, scores: 0 })
  })
})
