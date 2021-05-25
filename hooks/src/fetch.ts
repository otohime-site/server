import Router from "koa-router"
import { parsePlayer, parseScores } from "@otohime-site/parser/dx_intl"
import { query, join, value, compile } from "pg-sql2"

import { JSDOM, CookieJar } from "jsdom"
import nodeFetch from "node-fetch"
import fetchCookie from "fetch-cookie/node-fetch"
import { ScoresParseEntry } from "@otohime-site/parser/dx_intl/scores"
import pool from "./db"
import DxIntlVersions from "./dx_intl_versions"

const CURRENT_VERSION = 15
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

const segaId = process.env.SEGA_ID
const segaPassword = process.env.SEGA_PASSWORD
if (segaId === undefined || segaPassword === undefined) {
  throw new Error("Please assign SEGA_ID and SEGA_PASSWORD to use /fetch")
}

const fetch = async (): Promise<void> => {
  const jar = new CookieJar()
  const fetch = fetchCookie(nodeFetch, jar)
  globalThis.DOMParser = new JSDOM(
    "<!DOCTYPE html><html></html>"
  ).window.DOMParser

  // First, trying to sign in
  await fetch("https://maimaidx-eng.com/", { redirect: "follow" })
  const loginResp = await fetch(
    "https://lng-tgk-aime-gw.am-all.net/common_auth/login/sid/",
    {
      method: "POST",
      body: new URLSearchParams({
        retention: "1",
        sid: segaId,
        password: segaPassword,
      }),
      redirect: "follow",
    }
  )
  if (!loginResp.url.startsWith("https://maimaidx-eng.com/")) {
    throw new Error("Login failure")
  }
  // Assume the player can be parsed correctly
  parsePlayer(await loginResp.text())

  const parsedScores = await [...Array(5)].reduce<Promise<ScoresParseEntry[]>>(
    async (prevPromise, _, difficulty) => {
      const prev = await prevPromise
      console.log(`Running difficulty ${difficulty}...`)
      const resp = await fetch(
        `https://maimaidx-eng.com/maimai-mobile/record/musicGenre/search/?genre=99&diff=${difficulty}`
      )
      if (!resp.ok) {
        throw new Error("Network Error!")
      }
      const result = parseScores(await resp.text(), undefined, true)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return [...prev, ...result]
    },
    Promise.resolve([])
  )

  // Add version, then group by category -> title -> variant
  // For determine its order and version
  const groupedVariants = parsedScores.reduce<Array<Map<string, VariantMap>>>(
    (accr, curr) => {
      const { title, category, deluxe } = curr
      const categoryMap = accr[category - 1]
      const variantMap: VariantMap = categoryMap.get(title) ?? new Map()
      categoryMap.set(title, variantMap)
      const variant = variantMap.get(deluxe) ?? {
        version: DxIntlVersions.findIndex(
          (verSongs, verIndex) =>
            ((deluxe ? verIndex >= 13 : verIndex < 13) &&
              verSongs.includes(title)) ||
            verSongs.some(
              (verSong) =>
                Array.isArray(verSong) &&
                verSong[0] === title &&
                verSong[1] === category
            )
        ),
      }
      if (variant.version === -1) {
        console.warn(`Cannot find version for ${curr.title}!`)
        variant.version = CURRENT_VERSION
      }
      variantMap.set(deluxe, variant)
      return accr
    },
    [...Array(6)].map(() => new Map())
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
          []
        ),
      ]
    },
    []
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
        )`
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

    for await (const _ of variantQueries.map(
      async ({ text, values }) => await client.query(text, values)
    )) {
    }

    // Write notes
    const noteQueries = parsedScores.map((score) =>
      compile(query`
      INSERT INTO dx_intl_notes (song_id, deluxe, difficulty, level) VALUES
      (
        encode(sha256(${value(`${score.category}_${score.title}`)}), 'hex'),
        ${value(score.deluxe)},
        ${value(score.difficulty)},
        ${value(score.level)}
      )
      ON CONFLICT (song_id, deluxe, difficulty) DO UPDATE SET level = excluded.level;
      `)
    )

    for await (const _ of noteQueries.map(
      async ({ text, values }) => await client.query(text, values)
    )) {
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
  await fetch()
  ctx.body = "ok!"
})

export default router

if (require.main === module) {
  fetch()
    .then(() => console.log("ok!"))
    .catch((e) => {
      throw e
    })
}
