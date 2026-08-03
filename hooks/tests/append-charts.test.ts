import assert from "node:assert/strict"
import { test } from "node:test"

import type { ScoresParseEntry } from "@otohime-site/parser/dx_intl/scores"
import { appendCharts, type AppendChartRule } from "../src/append-charts.ts"

const score = (
  category: number,
  title: string,
  deluxe: boolean,
): ScoresParseEntry => ({
  category,
  title,
  deluxe,
  difficulty: 1,
  level: "8",
})

test("adds multiple hidden charts through an appended anchor", () => {
  const rules: readonly AppendChartRule[] = [
    {
      seeingTitle: "5_Amereistr_t",
      anchorTitle: "5_FLΛME/FRΦST_t",
      appendPosition: "after",
      title: "5_World's end BLACKBOX_t",
      levels: ["7+", "10", "13", "14+"],
    },
    {
      seeingTitle: "5_Amereistr_t",
      anchorTitle: "5_World's end BLACKBOX_t",
      appendPosition: "after",
      title: "5_Xaleid◆scopiX_t",
      levels: ["7+", "11", "13+", "14+", "15"],
      long: true,
    },
  ]

  const result = appendCharts(
    [score(5, "FLΛME/FRΦST", true), score(5, "Amereistr", true)],
    1,
    rules,
  )

  assert.deepEqual(result, [
    score(5, "FLΛME/FRΦST", true),
    {
      category: 5,
      title: "World's end BLACKBOX",
      deluxe: true,
      difficulty: 1,
      level: "10",
    },
    {
      category: 5,
      title: "Xaleid◆scopiX",
      deluxe: true,
      difficulty: 1,
      level: "11",
    },
    score(5, "Amereistr", true),
  ])
})

test("inserts a chart before its anchor", () => {
  const rules: readonly AppendChartRule[] = [
    {
      seeingTitle: "6_キミは“見ていたね”？_t",
      anchorTitle: "4_AiAe_t",
      appendPosition: "before",
      title: "4_奇々解体_t",
      levels: ["3", "6", "9+", "13"],
    },
  ]

  const result = appendCharts(
    [score(4, "AiAe", true), score(6, "キミは“見ていたね”？", true)],
    1,
    rules,
  )

  assert.deepEqual(result, [
    {
      category: 4,
      title: "奇々解体",
      deluxe: true,
      difficulty: 1,
      level: "6",
    },
    score(4, "AiAe", true),
    score(6, "キミは“見ていたね”？", true),
  ])
})

test("requires the seeing chart to come from DXNET", () => {
  const rules: readonly AppendChartRule[] = [
    {
      seeingTitle: "6_キミは“見ていたね”？_t",
      anchorTitle: "4_AiAe_t",
      appendPosition: "before",
      title: "4_奇々解体_t",
      levels: ["3", "6", "9+", "13"],
    },
  ]

  const result = appendCharts([score(4, "AiAe", true)], 1, rules)

  assert.deepEqual(result, [score(4, "AiAe", true)])
})

test("does not duplicate an existing chart", () => {
  const rules: readonly AppendChartRule[] = [
    {
      seeingTitle: "2_スノーマン (Rerec)_t",
      anchorTitle: "2_スノーマン (Rerec)_t",
      appendPosition: "after",
      title: "2_ヤミナベ!!!!_t",
      levels: ["6", "8", "12+", "14"],
    },
  ]

  const result = appendCharts(
    [score(2, "スノーマン (Rerec)", true), score(2, "ヤミナベ!!!!", true)],
    1,
    rules,
  )

  assert.equal(result.filter(({ title }) => title === "ヤミナベ!!!!").length, 1)
})
