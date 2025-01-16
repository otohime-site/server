import {
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
  category: number
  title: string
  deluxe: boolean
  levels: ScoresParseEntry["level"][]
}

export const rules: AppendNoteRule[] = [
  {
    followingTitle: "184億回のマルチトニック",
    category: 5,
    title: "果ての空、僕らが見た光。",
    deluxe: true,
    levels: ["4", "8", "10+", "13+"],
  },
  {
    followingTitle: "果ての空、僕らが見た光。",
    category: 5,
    title: "Cryptarithm",
    deluxe: true,
    levels: ["6", "8", "13", "14+"],
  },
  {
    followingTitle: "Deicide",
    category: 5,
    title: "氷滅の135小節",
    deluxe: true,
    levels: ["7", "9+", "13", "14+"],
  },
  {
    followingTitle: "シスターシスター",
    category: 5,
    title: "有明/Ariake",
    deluxe: true,
    levels: ["5", "8", "12", "14"],
  },
]

export const appendNotes = (
  scores: ScoresParseEntry[],
  difficulty: number,
): ScoresParseEntry[] => {
  const appendedScores = [...scores]
  for (const rule of rules) {
    const appendIndex = appendedScores.findIndex(
      (s) => s.title === rule.followingTitle,
    )
    const entryIndex = appendedScores.findIndex((s) => s.title === rule.title)

    if (appendIndex >= 0 && entryIndex === -1 && rule.levels[difficulty]) {
      const toBeAppended: ScoresParseEntryWithoutScore = {
        category: rule.category,
        title: rule.title,
        deluxe: rule.deluxe,
        difficulty: difficulty,
        level: rule.levels[difficulty],
      }
      console.log(
        `Inserting ${toBeAppended.title} after ${rule.followingTitle}`,
      )
      appendedScores.splice(appendIndex + 1, 0, toBeAppended)
    }
  }
  return appendedScores
}
