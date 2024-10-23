import { parsePlayer, parseScores } from "@otohime-site/parser/dx_intl"
import Router from "koa-router"
import { compile, join, query, value } from "pg-sql2"

import { ScoresParseEntryWithoutScore } from "@otohime-site/parser/dx_intl/scores"
import makeFetchCookie from "fetch-cookie"
import { CookieJar, JSDOM } from "jsdom"
import pool from "./db.js"
import InternalLvJsonBuddiesPlus from "./internal_lv_buddies_plus.json" with { type: "json" }
import Versions from "./versions.json" with { type: "json" }

interface VariantProps {
  version: number
}
type VariantMap = Map<boolean, VariantProps>

interface SongToWrite {
  category: number
  order: number
  title: string
  variants: Array<[boolean, VariantProps]>
}

interface ScoreEntry extends ScoresParseEntryWithoutScore {
  internal_lv?: number
}

const validInternalLv = (
  level: ScoreEntry["level"],
  internalLv: number,
): boolean => {
  switch (level) {
    case "12":
      return internalLv >= 12.0 && internalLv <= 12.5
    case "12+":
      return internalLv >= 12.6 && internalLv <= 12.9
    case "13":
      return internalLv >= 13.0 && internalLv <= 13.5
    case "13+":
      return internalLv >= 13.6 && internalLv <= 13.9
    case "14":
      return internalLv >= 14.0 && internalLv <= 14.5
    case "14+":
      return internalLv >= 14.6 && internalLv <= 14.9
    case "15":
      return internalLv === 15.0
  }
  return false
}

const segaId = process.env.SEGA_ID
const segaPassword = process.env.SEGA_PASSWORD
if (segaId === undefined || segaPassword === undefined) {
  throw new Error("Please assign SEGA_ID and SEGA_PASSWORD to use /fetch")
}

export const fetchSongs = async (): Promise<void> => {
  const CURRENT_VERSION = 22

  const internalLvDict: Record<string, number> = InternalLvJsonBuddiesPlus

  const jar = new CookieJar()
  const fetchCookie = makeFetchCookie(global.fetch, jar)
    globalThis.DOMParser = new JSDOM(
    "<!DOCTYPE html><html></html>",
  ).window.DOMParser

  // First, trying to sign in
  await fetchCookie("https://maimaidx-eng.com/", { redirect: "follow" })
  const loginResp = await fetchCookie(
    "https://lng-tgk-aime-gw.am-all.net/common_auth/login/sid/",
    {
      method: "POST",
      body: new URLSearchParams({
        retention: "1",
        sid: segaId,
        password: segaPassword,
      }),
      redirect: "follow",
    },
  )
  if (!loginResp.url.startsWith("https://maimaidx-eng.com/")) {
    throw new Error("Login failure")
  }
  // Assume the player can be parsed correctly
  parsePlayer(await loginResp.text())

  const parsedScores = await [...Array(5)].reduce<Promise<ScoreEntry[]>>(
    async (prevPromise, _, difficulty) => {
      const prev = await prevPromise
      console.log(`Running difficulty ${difficulty}...`)
      const resp = await fetchCookie(
        `https://maimaidx-eng.com/maimai-mobile/record/musicGenre/search/?genre=99&diff=${difficulty}`,
      )
      if (!resp.ok) {
        throw new Error("Network Error!")
      }
      const result = parseScores(await resp.text(), undefined, true)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return [
        ...prev,
        ...result.map((entry) => {
          const dictKey = `${entry.category}_${entry.title}_${
            entry.deluxe ? "t" : "f"
          }_${entry.difficulty}`
          const internalLv = internalLvDict[dictKey]
          if (internalLv == null) {
            if (["12+", "13", "13+", "14", "14+", "15"].includes(entry.level)) {
              console.log(`Internal Lv not found on ${dictKey}`)
            }
            return entry
          }
          if (!validInternalLv(entry.level, internalLv)) {
            console.log(`Internal Lv is not matched with level on ${dictKey}`)
            return entry
          }
          return {
            ...entry,
            internal_lv: internalLv,
          }
        }),
      ]
    },
    Promise.resolve([]),
  )

  // Add version, then group by category -> title -> variant
  // For determine its order and version
  const groupedVariants = parsedScores.reduce<Array<Map<string, VariantMap>>>(
    (accr, curr) => {
      const { title, category, deluxe } = curr
      const categoryMap = accr[category - 1]
      const variantMap: VariantMap = categoryMap.get(title) ?? new Map()
      categoryMap.set(title, variantMap)
      const verKey = `${curr.category}_${curr.title}_${curr.deluxe ? "t" : "f"}`
      const variant = variantMap.get(deluxe) ?? {
        version: Versions.findIndex((verSongs) => verSongs.includes(verKey)),
      }
      if (variant.version === -1) {
        console.warn(`Version missing: ${JSON.stringify(verKey)}`)
        variant.version = CURRENT_VERSION
      }
      variantMap.set(deluxe, variant)
      return accr
    },
    [...Array(6)].map(() => new Map()),
  )

  // Flat the previous group for easy writing.
  const songsToWrite = groupedVariants.reduce<SongToWrite[]>(
    (prev, categoryMap, index) => {
      const category = index + 1
      return [
        ...prev,
        ...[...categoryMap.entries()].reduce<SongToWrite[]>(
          (innerPrev, [title, variantMap], innerIndex) => [
            ...innerPrev,
            {
              category,
              title,
              order: innerIndex + 1,
              variants: [...variantMap.entries()],
            },
          ],
          [],
        ),
      ]
    },
    [],
  )

  console.log("Writing into database...")
  const client = await pool.connect()

  try {
    await client.query("BEGIN")
    // Write songs and variants
    await client.query("UPDATE dx_intl_variants SET active = false;")
    const variantQueries = songsToWrite.map((song) => {
      const variantQueries = song.variants.map(
        ([deluxe, variantProps]) => query`
        (
          (SELECT id FROM song),
          ${value(deluxe)},
          ${value(variantProps.version)},
          true
        )`,
      )
      return compile(query`
    WITH song as (
      INSERT INTO dx_intl_songs (id, category, title, "order") VALUES (
        encode(sha256(${value(`${song.category}_${song.title}`)}), 'hex'),
        ${value(song.category)},
        ${value(song.title)},
        ${value(song.order)}
      )
      ON CONFLICT (category, title) DO UPDATE SET "order" = excluded.order RETURNING id
    ) INSERT INTO dx_intl_variants(song_id, deluxe, version, active) VALUES
      ${join(variantQueries, ", ")}
      ON CONFLICT (song_id, deluxe) DO UPDATE SET active = excluded.active, version = excluded.version
    `)
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of variantQueries.map(
      async ({ text, values }) => await client.query(text, values),
    )) {
      // pass
    }

    // Write notes
    const noteQueries = parsedScores.map((score) =>
      compile(query`
      INSERT INTO dx_intl_notes (song_id, deluxe, difficulty, level, internal_lv) VALUES
      (
        encode(sha256(${value(`${score.category}_${score.title}`)}), 'hex'),
        ${value(score.deluxe)},
        ${value(score.difficulty)},
        ${value(score.level)},
        ${value(score.internal_lv)}
      )
      ON CONFLICT (song_id, deluxe, difficulty) DO UPDATE SET level = excluded.level, internal_lv = excluded.internal_lv;
      `),
    )

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of noteQueries.map(
      async ({ text, values }) => await client.query(text, values),
    )) {
      // pass
    }
    await client.query("COMMIT")
  } catch (e) {
    console.log("rolling back...")
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}

const router = new Router()

router.post("/", async (ctx) => {
  await fetchSongs()
  ctx.body = "ok!"
})

export default router
