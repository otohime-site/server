import type {
  ScoresParseEntry,
  ScoresParseEntryWithoutScore,
} from "@otohime-site/parser/dx_intl/scores"

/*
This is prepared as the DXNET after PRiSM update will hide some
songs until player unlocked them, e.g. LEGEND and special event songs.
*/

export interface AppendChartRule {
  // When seeing this title in the DXNET...
  readonly seeingTitle: string
  // Using the following title as the anchor...
  readonly anchorTitle: string
  // And put the song before or after the anchor.
  readonly appendPosition: "before" | "after"

  // Then is the appended song & chart data
  readonly title: string
  readonly levels: readonly ScoresParseEntry["level"][]

  // TODO: can we get it from DXNET?
  readonly long?: boolean
}

export const rules: readonly AppendChartRule[] = [
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
  {
    seeingTitle: "1_キスキツネ_t",
    anchorTitle: "5_KNØCK ØUT!!_t",
    appendPosition: "after",
    title: "5_OV3RCLOCK_t",
    levels: ["6", "7+", "12+", "14+"],
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
  chartRules: readonly AppendChartRule[],
): ScoresParseEntry[] => {
  const appendedScores = [...scores]
  for (const rule of chartRules) {
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
