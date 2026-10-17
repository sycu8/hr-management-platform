/** Short column header from full cycle name — e.g. "Đánh giá năm 2025" → "NĂM 2025". */
export function shortCycleLabel(name: string): string {
  const n = name.trim()
  let m = /giữa\s*năm\s*(\d{4})/i.exec(n)
  if (m) return `GIỮA NĂM ${m[1]}`
  m = /cuối\s*năm\s*(\d{4})/i.exec(n)
  if (m) return `CUỐI NĂM ${m[1]}`
  m = /năm\s*(\d{4})/i.exec(n)
  if (m) return `NĂM ${m[1]}`
  return n.toUpperCase()
}

/** Chart axis label — lowercase short form. */
export function chartCycleLabel(name: string): string {
  return shortCycleLabel(name).toLowerCase()
}

export type TrendKind = 'up' | 'down' | 'stable' | 'insufficient'

export type Trend = {
  kind: TrendKind
  delta: number | null
  label: string
}

function formatViDelta(n: number): string {
  return Math.abs(n).toFixed(1).replace('.', ',')
}

/**
 * Trend from chronologically ordered cycle scores (null = missing).
 * Compares the last two non-null scores. |Δ| < 0.05 → stable.
 */
export function computeTrend(scoresInOrder: Array<number | null>): Trend {
  const vals = scoresInOrder.filter(
    (s): s is number => s != null && Number.isFinite(s),
  )
  if (vals.length < 2) {
    return { kind: 'insufficient', delta: null, label: 'Chưa đủ dữ liệu' }
  }
  const prev = vals[vals.length - 2]!
  const curr = vals[vals.length - 1]!
  const delta = Math.round((curr - prev) * 10) / 10
  if (Math.abs(delta) < 0.05) {
    return { kind: 'stable', delta: 0, label: 'Ổn định' }
  }
  if (delta > 0) {
    return { kind: 'up', delta, label: `Tăng ${formatViDelta(delta)}` }
  }
  return { kind: 'down', delta, label: `Giảm ${formatViDelta(delta)}` }
}

/** Scores ≤ this threshold render in the warn (yellow) tone. */
export const LOW_SCORE_THRESHOLD = 3.4

export function isLowScore(score: number): boolean {
  return score <= LOW_SCORE_THRESHOLD
}

/** Prefer final, then manager, then self. */
export function pickScore(
  finalScore: number | null | undefined,
  managerScore: number | null | undefined,
  selfScore: number | null | undefined,
): number | null {
  for (const v of [finalScore, managerScore, selfScore]) {
    if (v != null && Number.isFinite(v)) return Number(v)
  }
  return null
}
