import { parsePlayer, parseScores } from "@otohime-site/parser/dx_intl"
import { createHash } from "crypto"

import { ScoresParseEntryWithoutScore } from "@otohime-site/parser/dx_intl/scores"
import makeFetchCookie from "fetch-cookie"
import { Hono } from "hono"
import { DOMParser } from "linkedom"
import { appendNotes } from "./append-notes.js"
import sql from "./db.js"
import Infos from "./infos.json" with { type: "json" }
import InternalLvJson24PrismPlus from "./internal_lvs/24_prism_plus.json" with { type: "json" }
import InternalLvJson25Circle from "./internal_lvs/25_circle.json" with { type: "json" }
import Versions from "./versions.json" with { type: "json" }

interface VariantProps {
  version: number
}
type VariantMap = Map<boolean, VariantProps>

interface SongRow {
  id: string
  category: number
  title: string
  order: number
}

interface VariantRow {
  song_id: string
  deluxe: boolean
  version: number
  active: boolean
}

interface NoteRow {
  song_id: string
  deluxe: boolean
  difficulty: number
  level: ScoreEntry["level"]
  internal_lv: number | null
}

interface ScoreEntry extends ScoresParseEntryWithoutScore {
  internal_lv?: number
}

const validInternalLv = (
  level: ScoreEntry["level"],
  internalLv: number,
): boolean => {
  switch (level) {
    case "10":
      return internalLv >= 10.0 && internalLv <= 10.5
    case "10+":
      return internalLv >= 10.6 && internalLv <= 10.9
    case "11":
      return internalLv >= 11.0 && internalLv <= 11.5
    case "11+":
      return internalLv >= 11.6 && internalLv <= 11.9
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

const sha256Sum = (text: string): string =>
  createHash("sha256").update(text).digest("hex")

export const fetchSongs = async (): Promise<void> => {
  const CURRENT_VERSION =
    new Date() > new Date("2026-01-22T04:00:00+09:00") ? 25 : 24

  const internalLvDict: Record<string, number> =
    CURRENT_VERSION === 25 ? InternalLvJson25Circle : InternalLvJson24PrismPlus
  const infoDict: Record<string, { artist: string; title_kana: string }> = Infos

  const fetchCookie = makeFetchCookie(global.fetch)
  // @ts-expect-error The DOMParser did not match the TypeScript definition
  globalThis.DOMParser = DOMParser

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
      const result = appendNotes(
        parseScores(await resp.text(), undefined, true),
        difficulty,
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return [
        ...prev,
        ...result.map((entry) => {
          const dictKey = `${entry.category}_${entry.title}_${
            entry.deluxe ? "t" : "f"
          }_${entry.difficulty}`
          const internalLv = internalLvDict[dictKey]
          if (internalLv == null) {
            if (
              [
                "10",
                "10+",
                "11",
                "11+",
                "12",
                "12+",
                "13",
                "13+",
                "14",
                "14+",
                "15",
              ].includes(entry.level)
            ) {
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
  const groupedSongVariants = parsedScores.reduce<
    Array<Map<string, VariantMap>>
  >(
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

  // Prepare songs, variants notes to be written to database
  // as list of objects for Postgres.js to insert them.
  const songRows: SongRow[] = []
  const variantRows: VariantRow[] = []
  for (const [index, categoryMap] of groupedSongVariants.entries()) {
    const category = index + 1
    let order = 1
    for (const [title, variantMap] of categoryMap) {
      // Postgres.js will also fail with UNDEFINED_VALUE
      // if key is not present in some of the entry.
      const info = infoDict[`${category}_${title}`] ?? {
        artist: null,
        title_kana: null,
      }
      songRows.push({
        id: sha256Sum(`${category}_${title}`),
        category,
        title,
        order,
        ...info,
      })
      order += 1
      for (const [deluxe, { version }] of variantMap) {
        variantRows.push({
          song_id: sha256Sum(`${category}_${title}`),
          deluxe,
          version,
          active: true,
        })
      }
    }
  }
  const noteRows: NoteRow[] = parsedScores.map(
    ({ category, title, deluxe, difficulty, level, internal_lv }) => ({
      song_id: sha256Sum(`${category}_${title}`),
      deluxe,
      difficulty,
      level,
      // Postgres.js will not like undefined
      internal_lv: internal_lv ?? null,
    }),
  )

  console.log("Writing into database...")

  // Perform the upserts.
  await sql.begin(async (tx) => {
    await tx`UPDATE dx_intl_variants SET active = false;`
    await tx`
      INSERT INTO dx_intl_songs ${sql(songRows)}
      ON CONFLICT (category, title) DO UPDATE SET
      "order" = excluded.order, artist = excluded.artist, title_kana = excluded.title_kana;`
    await tx`
      INSERT INTO dx_intl_variants ${sql(variantRows)}
      ON CONFLICT (song_id, deluxe) DO UPDATE SET
      active = excluded.active, version = excluded.version;`
    await tx`
      INSERT INTO dx_intl_notes ${sql(noteRows)}
      ON CONFLICT (song_id, deluxe, difficulty) DO UPDATE SET
      level = excluded.level, internal_lv = excluded.internal_lv;`
  })
}
const app = new Hono()

app.post("/", async (c) => {
  await fetchSongs()
  return c.text("ok!")
})

export default app
