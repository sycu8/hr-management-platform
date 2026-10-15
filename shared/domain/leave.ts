import { tenureYears, workdays, type Holiday } from './dates.ts'

export type LeaveType = 'annual' | 'sick' | 'special' | 'unpaid' | string

export type LeaveRequest = {
  id: string
  empId: string
  type: LeaveType
  from: string
  to: string
  days: number
  status: 'pending' | 'approved' | 'rejected' | string
}

export type LeaveQuotaConfig = {
  annual: number
  sick: number
  special: number
}

export type LeaveEmployee = {
  id: string
  joined: string
}

/** Working days for a leave span (legacy leave `days` via `H.workdays`). */
export function leaveWorkdays(
  from: string,
  to: string,
  holidays: readonly Holiday[],
): number {
  return workdays(from, to, holidays)
}

/**
 * True when `[from,to]` overlaps a non-rejected leave for the same employee
 * (legacy submit check).
 */
export function leaveOverlaps(
  empId: string,
  from: string,
  to: string,
  leaves: readonly LeaveRequest[],
  excludeId?: string,
): boolean {
  return leaves.some(
    (l) =>
      l.empId === empId &&
      l.status !== 'rejected' &&
      l.id !== excludeId &&
      !(to < l.from || from > l.to),
  )
}

export type QuotaResult = {
  annual: number
  adj: number
  usedA: number
  pendA: number
  remA: number
  usedS: number
  usedP: number
  usedU: number
  sick: number
  spec: number
}

/**
 * Exact port of legacy `H.quota(e)`.
 * `asOf` replaces `H.TODAY` for tenure and year filter.
 */
export function leaveQuota(
  e: LeaveEmployee,
  leaves: readonly LeaveRequest[],
  leaveQuotaCfg: LeaveQuotaConfig,
  quotaAdj: Readonly<Record<string, number>>,
  asOf: Date,
): QuotaResult {
  const adj = quotaAdj[e.id] || 0
  const yr = asOf.getFullYear() + ''
  const used = (t: string) =>
    leaves
      .filter(
        (l) =>
          l.empId === e.id &&
          l.type === t &&
          l.status === 'approved' &&
          l.from.slice(0, 4) === yr,
      )
      .reduce((s, l) => s + l.days, 0)
  const pend = (t: string) =>
    leaves
      .filter((l) => l.empId === e.id && l.type === t && l.status === 'pending')
      .reduce((s, l) => s + l.days, 0)
  const annual =
    leaveQuotaCfg.annual + Math.floor(tenureYears(e.joined, asOf) / 5) + adj
  return {
    annual,
    adj,
    usedA: used('annual'),
    pendA: pend('annual'),
    remA: annual - used('annual'),
    usedS: used('sick'),
    usedP: used('special'),
    usedU: used('unpaid'),
    sick: leaveQuotaCfg.sick,
    spec: leaveQuotaCfg.special,
  }
}
