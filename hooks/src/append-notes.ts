import type {
  ScoresParseEntry,
  ScoresParseEntryWithoutScore,
} from "@otohime-site/parser/dx_intl/scores"

/*
This is prepared as the DXNET after PRiSM update will hide some
unlocked songs in the Japanese version.

It will be changed once the international version is updated.
*/

// If a song with specific title is found,
// append another song ater it.
interface AppendNoteRule {
  followingTitle: string
  title: string
  levels: ScoresParseEntry["level"][]
  // Reserved for future database usage.
  // TODO: can we get it from DXNET?
  long?: boolean
}

export const rules: AppendNoteRule[] = [
  // TODO: Decouple the append trigger from the insertion anchor. Once
  // 歌え踊れや桃源郷 is released, another song should trigger its insertion
  // at the top of category 5. Leave this empty until then.
]

const splitInfo = (
  rawTitle: string,
): { category: number; title: string; deluxe: boolean } => {
  const firstDash = rawTitle.indexOf("_")
  const lastDash = rawTitle.lastIndexOf("_")

  return {
    category: parseInt(rawTitle.substring(0, firstDash), 10),
    title: rawTitle.substring(firstDash + 1, lastDash),
    deluxe: rawTitle.substring(lastDash + 1, rawTitle.length) === "t",
  }
}

export const appendNotes = (
  scores: ScoresParseEntry[],
  difficulty: number,
): ScoresParseEntry[] => {
  const appendedScores = [...scores]
  for (const rule of rules) {
    const followingInfo = splitInfo(rule.followingTitle)
    const entryInfo = splitInfo(rule.title)

    const appendIndex = appendedScores.findIndex(
      (s) =>
        s.category === followingInfo.category &&
        s.title === followingInfo.title &&
        s.deluxe === followingInfo.deluxe,
    )
    const entryIndex = appendedScores.findIndex(
      (s) =>
        s.category === entryInfo.category &&
        s.title === entryInfo.title &&
        s.deluxe === entryInfo.deluxe,
    )

    if (appendIndex >= 0 && entryIndex === -1 && rule.levels[difficulty]) {
      const toBeAppended: ScoresParseEntryWithoutScore = {
        category: entryInfo.category,
        title: entryInfo.title,
        deluxe: entryInfo.deluxe,
        difficulty: difficulty,
        level: rule.levels[difficulty],
      }
      console.log(`Inserting ${rule.title} after ${rule.followingTitle}`)
      appendedScores.splice(appendIndex + 1, 0, toBeAppended)
    }
  }
  return appendedScores
}
