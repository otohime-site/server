import sql from "./db.js"
import Infos from "./infos.json" with { type: "json" }

// As the `fetch.ts` will update only for songs which still exists on DXNET,
// we need this to update removed songs.

const fillInfos = async () => {
  const infoDict: Record<string, { artist: string; title_kana: string }> = Infos

  const results = await sql<
    { id: string; category: string; title: string }[]
  >`SELECT id, category, title FROM dx_intl_songs;`
  const infoToBeUpdated = results
    .map(({ id, category, title }) => {
      const info = infoDict[`${category}_${title}`]
      return {
        id,
        ...info,
      }
    })
    .filter((u) => !!u.artist && !!u.title_kana)
    .map((u) => [u.id, u.artist, u.title_kana])
  await sql`
  UPDATE dx_intl_songs SET artist = u.artist, title_kana = u.title_kana
  FROM (VALUES ${sql(infoToBeUpdated)}) AS u (id, artist, title_kana)
  WHERE dx_intl_songs.id = u.id
  `
}
fillInfos()
  .then(() => console.log("ok!"))
  .catch((e) => {
    throw e
  })
  .finally(() => {
    sql.end()
  })
