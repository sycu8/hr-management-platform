/** UTC midnight key for calendar-day difference (legacy `dayKey`). */
export function dayKey(s: string): number {
  const d = new Date(s)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Whole calendar nights between two datetimes (legacy `dateDiff`). */
export function dateDiff(a: string, b: string): number {
  return Math.round((dayKey(b) - dayKey(a)) / 864e5)
}

/** `yyyy-mm-dd` from a Date (legacy `H.iso`). */
export function toIsoDate(d: Date): string {
  const x = new Date(d)
  return (
    x.getFullYear() +
    '-' +
    ('0' + (x.getMonth() + 1)).slice(-2) +
    '-' +
    ('0' + x.getDate()).slice(-2)
  )
}

/** Add calendar days to a `yyyy-mm-dd` string (legacy `H.addDays`). */
export function addDays(s: string, n: number): string {
  const d = new Date(s + 'T12:00')
  d.setDate(d.getDate() + n)
  return toIsoDate(d)
}

export function isWeekend(s: string): boolean {
  const w = new Date(s + 'T12:00').getDay()
  return w === 0 || w === 6
}

export type Holiday = readonly [date: string, name: string]

export function holidayName(s: string, holidays: readonly Holiday[]): string {
  const h = holidays.find((x) => x[0] === s)
  return h ? h[1] : ''
}

/** All calendar dates in `yyyy-mm` (legacy `H.monthDays`). */
export function monthDays(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number)
  const n = new Date(y, m, 0).getDate()
  const a: string[] = []
  for (let i = 1; i <= n; i++) a.push(ym + '-' + ('0' + i).slice(-2))
  return a
}

/**
 * Count working days from `from` to `to` inclusive, excluding weekends and holidays
 * (legacy `H.workdays`).
 */
export function workdays(
  from: string,
  to: string,
  holidays: readonly Holiday[],
): number {
  let c = 0
  let d = from
  while (d <= to) {
    if (!isWeekend(d) && !holidays.some((x) => x[0] === d)) c++
    d = addDays(d, 1)
  }
  return c
}

/** Fractional years of tenure (legacy `H.tenureYears`). */
export function tenureYears(joined: string, asOf: Date): number {
  const a = new Date(joined)
  return Math.max(0, (asOf.getTime() - a.getTime()) / (365.25 * 864e5))
}

/** Day-number used by attendance simulation hash (legacy `Math.floor(new Date(ds+'T00:00Z')/864e5)`). */
export function utcDayNumber(ds: string): number {
  return Math.floor(new Date(ds + 'T00:00Z').getTime() / 864e5)
}
