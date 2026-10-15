import {
  holidayName,
  isWeekend,
  monthDays,
  type Holiday,
  utcDayNumber,
} from './dates.ts'

export type AttCode =
  | 'W'
  | 'M'
  | 'P'
  | 'OM'
  | 'VR'
  | 'KL'
  | 'CT'
  | 'V'
  | 'off'
  | ''
  | 'none'

export type AttDay = {
  c: AttCode | string
  in?: string
  out?: string
}

export type AttMonth = {
  W: number
  M: number
  P: number
  OM: number
  VR: number
  KL: number
  CT: number
  V: number
  none: number
  std: number
  unpaid: number
  paid: number
  late: number
  [key: string]: number
}

export type AttEmployee = {
  id: string
  joined: string
  leftDate?: string
  status?: string
}

export type AttLeave = {
  empId: string
  type: string
  from: string
  to: string
  status: string
}

export type AttTrip = {
  empId: string
  status: string
  start: string
  end: string
}

export type Checkin = { in: string; out: string }

const LEAVE_CODE: Record<string, string> = {
  annual: 'P',
  sick: 'OM',
  special: 'VR',
  unpaid: 'KL',
}

function fmtMin(m: number): string {
  return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2)
}

export type AttOfContext = {
  employee: AttEmployee | undefined
  date: string
  todayStr: string
  holidays: readonly Holiday[]
  leaves: readonly AttLeave[]
  trips: readonly AttTrip[]
  checkins: Readonly<Record<string, Checkin>>
}

/**
 * Exact port of legacy `H.attOf(id, ds)`.
 * Priority: not employed → weekend/holiday → approved leave → approved trip →
 * real check-in → future empty → deterministic past simulation.
 */
export function attOf(ctx: AttOfContext): AttDay {
  const e = ctx.employee
  const ds = ctx.date
  if (!e) return { c: 'none' }
  if (ds < e.joined || (e.leftDate && ds > e.leftDate)) return { c: 'none' }
  if (isWeekend(ds) || holidayName(ds, ctx.holidays)) return { c: 'off' }
  const lv = ctx.leaves.find(
    (l) =>
      l.empId === e.id &&
      l.status === 'approved' &&
      ds >= l.from &&
      ds <= l.to,
  )
  if (lv) return { c: LEAVE_CODE[lv.type] }
  if (
    ctx.trips.some(
      (t) =>
        t.empId === e.id &&
        ['ap', 'st', 'ok'].includes(t.status) &&
        ds >= t.start.slice(0, 10) &&
        ds <= t.end.slice(0, 10),
    )
  ) {
    return { c: 'CT' }
  }
  const ci = ctx.checkins[ds + '|' + e.id]
  if (ci) return { c: ci.in > '08:15' ? 'M' : 'W', in: ci.in, out: ci.out }
  if (ds >= ctx.todayStr) return { c: '' }
  const n = parseInt(e.id.slice(1), 10)
  const dn = utcDayNumber(ds)
  const h = ((n * 131 + dn * 7919) % 97 + 97) % 97
  if (h < 2) return { c: 'V' }
  if (h < 9) return { c: 'M', in: fmtMin(8 * 60 + 16 + (h % 25)), out: fmtMin(17 * 60 + 30 + (h % 25)) }
  return { c: 'W', in: fmtMin(7 * 60 + 40 + (h % 35)), out: fmtMin(17 * 60 + 30 + (h % 25)) }
}

/** Legacy `H.attMonth`. */
export function attMonth(
  empId: string,
  ym: string,
  ctx: Omit<AttOfContext, 'employee' | 'date'> & {
    employees: readonly AttEmployee[]
  },
): AttMonth {
  const r: AttMonth = {
    W: 0,
    M: 0,
    P: 0,
    OM: 0,
    VR: 0,
    KL: 0,
    CT: 0,
    V: 0,
    none: 0,
    std: 0,
    unpaid: 0,
    paid: 0,
    late: 0,
  }
  const employee = ctx.employees.find((e) => e.id === empId)
  monthDays(ym).forEach((ds) => {
    if (isWeekend(ds)) return
    r.std++
    const c = attOf({ ...ctx, employee, date: ds }).c
    if (r[c] != null) r[c]++
    if (c === 'none' || c === 'V' || c === 'KL' || c === 'OM') r.unpaid++
  })
  r.paid = r.std - r.unpaid
  r.late = r.M
  return r
}

/** Legacy `H.presence` for one day. */
export function presence(
  ds: string,
  employees: readonly AttEmployee[],
  ctx: Omit<AttOfContext, 'employee' | 'date'>,
): { exp: number; pr: number; lv: number; ab: number; rate: number } {
  let exp = 0
  let pr = 0
  let lv = 0
  let ab = 0
  employees.forEach((e) => {
    const c = attOf({ ...ctx, employee: e, date: ds }).c
    if (c === 'none' || c === 'off') return
    exp++
    if (c === '') return
    if (c === 'W' || c === 'M' || c === 'CT') pr++
    else if (c === 'V') ab++
    else lv++
  })
  return { exp, pr, lv, ab, rate: exp ? (pr / exp) * 100 : 0 }
}
