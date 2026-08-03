import type {
  ScoresParseEntry,
  ScoresParseEntryWithoutScore,
} from "@otohime-site/parser/dx_intl/scores"

/*
This is prepared as the DXNET after PRiSM update will hide some
songs until player unlocked them, e.g. LEGEND and special event songs.
*/

interface AppendChartRule {
  // When seeing this title in the DXNET...
  seeingTitle: string
  // Using the following title as the anchor...
  anchorTitle: string
  // And put the song before or after the anchor.
  appendPosition: "before" | "after"

  // Then is the appended song & chart data
  title: string
  levels: ScoresParseEntry["level"][]

  // TODO: can we get it from DXNET?
  long?: boolean
}

export const rules: AppendChartRule[] = [
  {
    seeingTitle: "6_キミは“見ていたね”？_t",
    anchorTitle: "4_AiAe_t",
    appendPosition: "before",
    title: "4_奇々解体_t",
    levels: ["3", "6", "9+", "13"],
  },
  {
    seeingTitle: "6_私たちは、花になる_t",
    anchorTitle: "5_TAKE CONTROL_t",
    appendPosition: "before",
    title: "5_歌え踊れや桃源郷！_t",
    levels: ["4", "7+", "10+", "13"],
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

const chartIndex = (scores: ScoresParseEntry[], rawTitle: string): number => {
  const chart = splitInfo(rawTitle)

  return scores.findIndex(
    (score) =>
      score.category === chart.category &&
      score.title === chart.title &&
      score.deluxe === chart.deluxe,
  )
}

export const appendCharts = (
  scores: ScoresParseEntry[],
  difficulty: number,
): ScoresParseEntry[] => {
  const appendedScores = [...scores]
  for (const rule of rules) {
    const level = rule.levels[difficulty]
    const seeingIndex = chartIndex(scores, rule.seeingTitle)
    const anchorIndex = chartIndex(appendedScores, rule.anchorTitle)
    const entryInfo = splitInfo(rule.title)
    const entryIndex = chartIndex(appendedScores, rule.title)

    if (
      seeingIndex >= 0 &&
      anchorIndex >= 0 &&
      entryIndex === -1 &&
      level !== undefined
    ) {
      const toBeAppended: ScoresParseEntryWithoutScore = {
        category: entryInfo.category,
        title: entryInfo.title,
        deluxe: entryInfo.deluxe,
        difficulty,
        level,
      }
      const insertIndex =
        anchorIndex + (rule.appendPosition === "after" ? 1 : 0)
      console.log(
        `Inserting ${rule.title} ${rule.appendPosition} ${rule.anchorTitle}`,
      )
      appendedScores.splice(insertIndex, 0, toBeAppended)
    }
  }
  return appendedScores
}
