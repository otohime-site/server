/* eslint-disable @typescript-eslint/promise-function-async */
import pool from './db'
import Router from 'koa-router'
import { parsePlayer, parseScores } from '@otohime-site/parser/dx_intl'
import { combineLatest, concat, from, of, throwError } from 'rxjs'
import { catchError, delay, finalize, flatMap, map, mergeMap, reduce, switchMap, takeLast, tap } from 'rxjs/operators'
import { JSDOM, CookieJar } from 'jsdom'
import nodeFetch from 'node-fetch'
import fetchCookie from 'fetch-cookie/node-fetch'
import { ScoresParseEntry } from '@otohime-site/parser/dx_intl/scores'
import DxIntlVersions from './dx_intl_versions'

const CURRENT_VERSION = 14
type VariantMap = Map<Boolean, {
  version: number
  levels: Array<ScoresParseEntry['level']>
}>

const segaId = process.env.SEGA_ID
const segaPassword = process.env.SEGA_PASSWORD
if (segaId === undefined || segaPassword === undefined) {
  throw new Error('Please assign SEGA_ID and SEGA_PASSWORD to use /fetch')
}

const router = new Router()

router.get('/', async (ctx, next) => {
  const jar = new CookieJar()
  const fetch = fetchCookie(nodeFetch, jar)
  globalThis.DOMParser = new JSDOM('<!DOCTYPE html><html></html>').window.DOMParser

  // First, trying to sign in
  await from(
    fetch('https://maimaidx-eng.com/', { redirect: 'follow' })
  ).pipe(
    switchMap(resp => fetch(
      'https://lng-tgk-aime-gw.am-all.net/common_auth/login/sid/', {
        method: 'POST',
        body: new URLSearchParams({
          retention: '1',
          sid: segaId,
          password: segaPassword
        }),
        redirect: 'follow'
      }
    )),
    switchMap(resp => {
      if (!resp.url.startsWith('https://maimaidx-eng.com/')) {
        throw new Error('Login failure')
      }
      return resp.text()
    }),
    map(parsePlayer),
    // Really fetching all difficulties (to get levels)
    switchMap(() =>
      from([...Array(5)].map((_, i) => i)).pipe(
        mergeMap((difficulty) =>
          from(fetch(`https://maimaidx-eng.com/maimai-mobile/record/musicGenre/search/?genre=99&diff=${difficulty}`)).pipe(
            switchMap(resp => {
              console.log(`Running difficulty ${difficulty}`)
              if (!resp.ok) { throw new Error('Network Error!') }
              return resp.text()
            }),
            map(text => parseScores(text, undefined, true)),
            delay(1000)
          ), 1)
      )
    ),
    // Aggregate results and get versions
    reduce<ScoresParseEntry[]>((acc, curr) => ([...acc, ...curr]), []),
    map(result => {
      return result.reduce<Array<Map<string, VariantMap>>>((accr, curr) => {
        const categoryMap = accr[curr.category - 1]
        const variantMap = categoryMap.get(curr.title) ?? new Map() as VariantMap
        categoryMap.set(curr.title, variantMap)
        const variant = variantMap.get(curr.deluxe) ?? {
          version: (curr.deluxe)
            ? DxIntlVersions.findIndex((verSongs, index) =>
              index >= 13 && (
                verSongs.includes(curr.title) ||
                verSongs.find(verSong => Array.isArray(verSong) && verSong[0] === curr.title && verSong[1] === curr.category)
              )
            )
            : DxIntlVersions.findIndex((verSongs, index) =>
              index < 13 && (
                verSongs.includes(curr.title) ||
                verSongs.find(verSong => Array.isArray(verSong) && verSong[0] === curr.title && verSong[1] === curr.category)
              )
            ),
          levels: []
        }
        if (variant.version === -1) {
          console.warn(`Cannot find level for ${curr.title}!`)
          variant.version = CURRENT_VERSION
        }
        variant.levels[curr.difficulty] = curr.level
        variantMap.set(curr.deluxe, variant)
        return accr
      }, [...Array(6)].map(() => new Map()))
    }),
    // Insert songs and notes into the database
    switchMap((result) => combineLatest([of(result), pool.connect()])),
    tap(() => console.log('Writing into database...')),
    flatMap(([result, client]) => (
      from(client.query('BEGIN')).pipe(
        flatMap(() => client.query('UPDATE dx_intl_notes SET active = false;')),
        flatMap(() => (
          from(
            result.reduce<Array<{ query: string, values?: any[] }>>((accr, categoryMap, index) => {
              const category = index + 1
              return [
                ...accr,
                ...[...categoryMap.entries()].reduce<Array<{ query: string, values?: any[] }>>(
                  (accr, [title, variantMap], index) => (
                    [...accr,
                      {
                        query: `
                        WITH song as (
                          INSERT INTO dx_intl_songs (category, title, "order") VALUES ($1, $2, $3)
                          ON CONFLICT (category, title) DO UPDATE SET "order" = excluded.order RETURNING id
                        )
                        INSERT INTO dx_intl_notes (song_id, deluxe, active, levels, version) VALUES
                        ${[...variantMap.entries()].map((_, index) => (
                          `
                          ((SELECT id FROM song), $${index * 3 + 4}, true, $${index * 3 + 5}, $${index * 3 + 6})
                          `
                        )).join(',\n')}
                        ON CONFLICT (song_id, deluxe) DO UPDATE SET active = true, levels = excluded.levels, version = excluded.version;
                        `,
                        values: [
                          category, title, index + 1,
                          ...[...variantMap.entries()].map(([deluxe, variant]) => (
                            [deluxe, `{${variant.levels.join(',')}}`, variant.version]
                          )).reduce((accr, curr) => [...accr, ...curr], [])
                        ]
                      }]
                  )
                  , [])
              ]
            }, [])
          ).pipe(
            mergeMap(({ query, values }) => client.query(query, values), 1)
          )
        )),
        takeLast(1),
        flatMap(() => client.query('COMMIT')),
        catchError((e) => concat(client.query('ROLLBACK'), throwError(e))),
        finalize(() => client.release())
      )
    ))
  ).toPromise()

  ctx.body = 'ok!'
})

export default router
