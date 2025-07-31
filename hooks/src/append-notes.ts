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
  // Reserved for future database usage.
  // TODO: can we get it from DXNET?
  long?: boolean
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
    followingTitle: "プリズム△▽リズム",
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
  {
    followingTitle: "雨露霜雪",
    category: 5,
    title: "宙天",
    deluxe: true,
    levels: ["6", "8+", "13", "14+"],
  },
  {
    followingTitle: "Feel The Luv",
    category: 5,
    title: "Åntinomiε",
    deluxe: true,
    levels: ["6", "9", "12+", "14+"],
  },
  {
    followingTitle: "忙シー日",
    category: 5,
    title: "FLΛME/FRΦST",
    deluxe: true,
    levels: ["5", "8", "12+", "14+"],
  },
  {
    followingTitle: "Åntinomiε",
    category: 5,
    title: "ATLAS RUSH",
    deluxe: true,
    levels: ["5", "7+", "12+", "14+"],
  },
  {
    followingTitle: "Amereistr",
    category: 5,
    title: "World's end BLACKBOX",
    deluxe: true,
    levels: ["7+", "10", "13", "14+"],
  },
  {
    followingTitle: "World's end BLACKBOX",
    category: 5,
    title: "プリズム△▽リズム",
    deluxe: false,
    levels: ["4", "6", "9", "13"],
  },
  {
    // Although there will be DX and STD variants,
    // We expected STD variant appeneed above will appear first in DXNET.
    followingTitle: "プリズム△▽リズム",
    category: 5,
    title: "Believe the Rainbow",
    deluxe: false,
    levels: ["2", "6", "9+", "13"],
  },
  {
    // Same reason as above.
    followingTitle: "Believe the Rainbow",
    category: 5,
    title: "AFTER PANDORA",
    deluxe: false,
    levels: ["3", "7+", "12", "14"],
  },
  {
    // Same reason as above.
    followingTitle: "AFTER PANDORA",
    category: 5,
    title: "Xaleid◆scopiX",
    deluxe: true,
    levels: ["7+", "11", "13+", "14+", "15"],
    long: true
  },
  {
    // Same reason as above.
    followingTitle: "Xaleid◆scopiX",
    category: 5,
    title: "Ref:rain (for 7th Heaven)",
    deluxe: true,
    levels: ["4", "8", "12", "14"],
    long: true
  }
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
