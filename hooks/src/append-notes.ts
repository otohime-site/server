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
  title: string
  levels: ScoresParseEntry["level"][]
  // Reserved for future database usage.
  // TODO: can we get it from DXNET?
  long?: boolean
}

export const rules: AppendNoteRule[] = [
  {
    followingTitle: "5_184億回のマルチトニック_t",
    title: "5_果ての空、僕らが見た光。_t",
    levels: ["4", "8", "10+", "13+"],
  },
  {
    followingTitle: "5_Deicide_t",
    title: "5_氷滅の135小節_t",
    levels: ["7", "9+", "13", "14+"],
  },
  {
    followingTitle: "5_シスターシスター_t",
    title: "5_有明/Ariake_t",
    levels: ["5", "8", "12", "14"],
  },
  {
    followingTitle: "5_雨露霜雪_t",
    title: "5_宙天_t",
    levels: ["6", "8+", "13", "14+"],
  },
  {
    followingTitle: "5_Feel The Luv_t",
    title: "5_Åntinomiε_t",
    levels: ["6", "9", "12+", "14+"],
  },
  {
    followingTitle: "5_Åntinomiε_t",
    title: "5_ATLAS RUSH_t",
    levels: ["5", "7+", "12+", "14+"],
  },
  {
    followingTitle: "5_忙シー日_t",
    title: "5_FLΛME/FRΦST_t",
    levels: ["5", "8", "12+", "14+"],
  },
  {
    followingTitle: "5_Amereistr_t",
    title: "5_World's end BLACKBOX_t",
    levels: ["7+", "10", "13", "14+"],
  },
  {
    followingTitle: "5_World's end BLACKBOX_t",
    title: "5_プリズム△▽リズム_f",
    levels: ["4", "6", "9", "13"],
  },
  {
    // Although there will be DX and STD variants,
    // We expected STD variant appeneed above will appear first in DXNET.
    followingTitle: "5_プリズム△▽リズム_f",
    title: "5_Believe the Rainbow_t",
    levels: ["2", "6", "9+", "13"],
  },
  {
    // Same reason as above.
    followingTitle: "5_Believe the Rainbow_t",
    title: "5_AFTER PANDORA_f",
    levels: ["3", "7+", "12", "14"],
  },
  {
    // Same reason as above.
    followingTitle: "5_AFTER PANDORA_f",
    title: "5_Xaleid◆scopiX_t",
    levels: ["7+", "11", "13+", "14+", "15"],
    long: true,
  },
  {
    // Same reason as above.
    followingTitle: "5_Xaleid◆scopiX_t",
    title: "5_Ref:rain (for 7th Heaven)_t",
    levels: ["4", "8", "12", "14"],
    long: true,
  },
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
      console.log(
        `Inserting ${rule.title} after ${rule.followingTitle}`,
      )
      appendedScores.splice(appendIndex + 1, 0, toBeAppended)
    }
  }
  return appendedScores
}
