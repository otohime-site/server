import sql from "./db.js"
import Infos from "./infos.json" with { type: "json" }

// As the `fetch.ts` will update only for songs which still exists on DXNET,
// we need this to update removed songs.

const fillInfos = async () => {
  // Once version upgrade, make a migration to change song hash
  // from 9545c71fdbed4fbef1212e686ee4f2fd19f7eca4d1cd53321d5d112ba9bd48ab
  // to   f03c27010e7a0edc9ffba698d0c33481e6ef0a24a3dd3cad5b5b136d7ebd259e

  const infoDict: Record<string, { artist: string; title_kana: string }> = Infos

  const results = await sql<
    { id: string; category: string; title: string }[]
  >`SELECT id, category, title FROM dx_intl_songs;`
  const infoToBeUpdated = results
    .map(({ id, category, title }) => {
      const info =
        // TODO: Remove this temporary workaround
        infoDict[
          `${category}_${title == "Help me, ERINNNNNN!!" ? "Help me, ERINNNNNN!!（Band ver.）" : title}`
        ]
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
