import sql from "./db.js"
// Copied from `otohime-web`.
// TODO: Figure out a better way to do this.
const ESTIMATED_INTERNAL_LV: Record<(string)[number], number> = {
  "1": 1.5,
  "2": 2.5,
  "3": 3.5,
  "4": 4.5,
  "5": 5.5,
  "6": 6.5,
  "7": 7.3,
  "7+": 7.8,
  "8": 8.3,
  "8+": 8.8,
  "9": 9.3,
  "9+": 9.8,
  "10": 10.3,
  "10+": 10.8,
  "11": 11.3,
  "11+": 11.8,
  "12": 12.3,
  "12+": 12.8,
  "13": 13.3,
  "13+": 13.8,
  "14": 14.3,
  "14+": 14.8,
  "15": 15, // While it should not happen
}
// Rating will be `internal_lv` * `rank_const` * `score`.
// As there are `.4999` and `.9999` score boundary, we need to avoid floating point issues.
// For example, the last line [1005000, 224] means for 100.5% score with level 14.0,
// internal lv will be floor(14.0 * 22.4 * 100.5%) = 315
// we will calculate with floor(140 * 224 * 1005000 / 100000000) = 315
export const RANK_CONST_BORDERS: Array<[number, number]> = [
  [800000, 136],
  [899999, 144],
  [900000, 152],
  [939999, 160],
  [940000, 168],
  [969999, 176],
  [970000, 200],
  [980000, 203],
  [989999, 206],
  [990000, 208],
  [995000, 211],
  [999999, 214],
  [1000000, 216],
  [1004999, 222],
  [1005000, 224],
]

export const getRankConstIndex = (score: number): number =>
  RANK_CONST_BORDERS.reduce(
    (curr, rank, idx) => (rank[0] <= score * 10000 ? idx : curr),
    -1,
  )

const getRating = (
  internalLv: number,
  score: number,
  ap?: boolean,
): number => {
  // AP bounus will be applied in CiRCLE.
  // Before the version upgrade, other logic will ensure `ap` will always be `false`.
  const rankScore = RANK_CONST_BORDERS[getRankConstIndex(score)]
  return rankScore != null
    ? Math.floor(
        (rankScore[1] * Math.min(1005000, score * 10000) * (internalLv * 10)) /
          100000000,
      ) + (ap ? 1 : 0)
    : 0
}

const ratingRefs = [
    14000,
    14250,
    14500,
    14750,
    15000,
    15250,
    15500,
    15750,
    16000,
    16250
]

const bestPerRating = async () => {
    for (const ratingRef of ratingRefs) {
        const scores = await sql`
            SELECT s.*, n.level, n.internal_lv
            FROM dx_intl_scores s
            INNER JOIN dx_intl_records r ON s.player_id = r.player_id
            INNER JOIN dx_intl_notes n ON
            s.song_id = n.song_id AND s.deluxe = n.deluxe AND s.difficulty = n.difficulty
            WHERE r.start > NOW() - INTERVAL '1 year'
              AND r.rating >= ${ratingRef - 125}
              AND r.rating <= ${ratingRef + 124}
        `
        console.log(`Rating ${ratingRef}: ${scores.length} scores`)
    }
}
bestPerRating()
  .then(() => console.log("ok!"))
  .catch((e) => {
    throw e
  })
  .finally(() => {
    sql.end()
  })
