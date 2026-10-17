export const CYCLE_STATUSES = ['planned', 'open', 'closed'] as const
export type CycleStatus = (typeof CYCLE_STATUSES)[number]

export const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  planned: 'Sắp mở',
  open: 'Đang mở',
  closed: 'Đã đóng',
}

export function isCycleStatus(value: string): value is CycleStatus {
  return (CYCLE_STATUSES as readonly string[]).includes(value)
}

export function cycleStatusLabel(status: string): string {
  if (isCycleStatus(status)) return CYCLE_STATUS_LABEL[status]
  return status
}

/** A rating counts as complete when final_score is set. */
export function isRatingComplete(finalScore: number | null | undefined): boolean {
  return finalScore != null && !Number.isNaN(finalScore)
}

/**
 * Derive final score from self + manager when both present and final omitted.
 * Average rounded to 1 decimal.
 */
export function deriveFinalScore(
  selfScore: number | null | undefined,
  managerScore: number | null | undefined,
  finalScore: number | null | undefined,
): number | null {
  if (finalScore != null && !Number.isNaN(finalScore)) return finalScore
  if (
    selfScore != null &&
    !Number.isNaN(selfScore) &&
    managerScore != null &&
    !Number.isNaN(managerScore)
  ) {
    return Math.round(((selfScore + managerScore) / 2) * 10) / 10
  }
  return null
}

export function progressPct(completed: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((completed / total) * 100)
}
