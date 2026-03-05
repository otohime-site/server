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
    followingTitle: "5_VERTeX (rintaro soma deconstructed remix)_t",
    title: "5_果ての空、僕らが見た光。_t",
    levels: ["4", "8", "10+", "13+"],
  },
  {
    followingTitle: "5_果ての空、僕らが見た光。_t",
    title: "5_氷滅の135小節_t",
    levels: ["7", "9+", "13", "14+"],
  },
  {
    followingTitle: "5_氷滅の135小節_t",
    title: "5_有明/Ariake_t",
    levels: ["5", "8", "12", "14"],
  },
  {
    followingTitle: "5_有明/Ariake_t",
    title: "5_宙天_t",
    levels: ["6", "8+", "13", "14+"],
  },
  {
    followingTitle: "5_宙天_t",
    title: "5_Åntinomiε_t",
    levels: ["6", "9", "12+", "14+"],
  },
  {
    followingTitle: "5_Åntinomiε_t",
    title: "5_FLΛME/FRΦST_t",
    levels: ["5", "8", "12+", "14+"],
  },
  {
    followingTitle: "5_FLΛME/FRΦST_t",
    title: "5_World's end BLACKBOX_t",
    levels: ["7+", "10", "13", "14+"],
  },
  {
    followingTitle: "5_プリズム△▽リズム_t",
    title: "5_プリズム△▽リズム_f",
    levels: ["4", "6", "9", "13"],
  },
  {
    followingTitle: "5_connecting with you_f",
    title: "5_Believe the Rainbow_t",
    levels: ["2", "6", "9+", "13"],
  },
  {
    followingTitle: "5_World's end BLACKBOX_t",
    title: "5_AFTER PANDORA_f",
    levels: ["3", "7+", "12", "14"],
  },
  {
    followingTitle: "5_AFTER PANDORA_f",
    title: "5_Xaleid◆scopiX_t",
    levels: ["7+", "11", "13+", "14+", "15"],
    long: true,
  },
  {
    followingTitle: "5_Xaleid◆scopiX_t",
    title: "5_Ref:rain (for 7th Heaven)_t",
    levels: ["4", "8", "12", "14"],
    long: true,
  },
  {
    followingTitle: "5_悪戯_f",
    title: "5_廃墟にいますキャンペーン_t",
    levels: ["5", "8", "10+", "13+"],
  },
  {
    followingTitle: "5_Magical Paradox_t",
    title: "5_7 Wonders_t",
    levels: ["6", "8", "12+", "14+"],
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
    // Unfortunately we have to hardcode this one exception...
    const followingTitle =
      rule.title === "5_Xaleid◆scopiX_t" && difficulty === 4
        ? "5_系ぎて_t"
        : rule.followingTitle
    const followingInfo = splitInfo(followingTitle)
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
      console.log(`Inserting ${rule.title} after ${followingTitle}`)
      appendedScores.splice(appendIndex + 1, 0, toBeAppended)
    }
  }
  return appendedScores
}
