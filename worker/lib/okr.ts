export type KeyResult = {
  kr: string
  progress: number
  target?: number
  current?: number
  unit?: string
  reverse?: boolean
  note?: string
  updated_at?: string
}

export type ParsedPeriod = {
  year: number
  /** Quarters covered 1–4 (H1 → 1,2; H2 → 3,4). */
  quarters: number[]
  label: string
  raw: string
}

const QUARTER_VI = /^Quý\s*([1-4])\s*\/\s*(\d{4})$/i
const Q_CODE = /^(\d{4})-Q([1-4])$/i
const H_CODE = /^(\d{4})-H([12])$/i

export function parsePeriod(raw: string): ParsedPeriod | null {
  const text = raw.trim()
  let m = Q_CODE.exec(text)
  if (m) {
    const year = Number(m[1])
    const q = Number(m[2])
    return { year, quarters: [q], label: `Q${q}/${year}`, raw: text }
  }
  m = H_CODE.exec(text)
  if (m) {
    const year = Number(m[1])
    const h = Number(m[2])
    const quarters = h === 1 ? [1, 2] : [3, 4]
    return { year, quarters, label: `H${h}/${year}`, raw: text }
  }
  m = QUARTER_VI.exec(text)
  if (m) {
    const q = Number(m[1])
    const year = Number(m[2])
    return { year, quarters: [q], label: `Q${q}/${year}`, raw: text }
  }
  return null
}

export function periodMatchesYear(raw: string, year: number): boolean {
  const p = parsePeriod(raw)
  return p?.year === year
}

export function periodTouchesQuarter(
  raw: string,
  year: number,
  quarter: number,
): boolean {
  const p = parsePeriod(raw)
  return !!p && p.year === year && p.quarters.includes(quarter)
}

export function parseKeyResults(json: string | null | undefined): KeyResult[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    const out: KeyResult[] = []
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const kr = typeof row.kr === 'string' ? row.kr : ''
      if (!kr) continue
      const progressRaw = row.progress
      const progress =
        typeof progressRaw === 'number' && Number.isFinite(progressRaw)
          ? Math.min(1, Math.max(0, progressRaw))
          : 0
      out.push({
        kr,
        progress,
        target: typeof row.target === 'number' ? row.target : undefined,
        current: typeof row.current === 'number' ? row.current : undefined,
        unit: typeof row.unit === 'string' ? row.unit : undefined,
        reverse: row.reverse === true ? true : undefined,
        note: typeof row.note === 'string' ? row.note : undefined,
        updated_at:
          typeof row.updated_at === 'string' ? row.updated_at : undefined,
      })
    }
    return out
  } catch {
    return []
  }
}

export function avgProgress(krs: KeyResult[]): number {
  if (krs.length === 0) return 0
  return krs.reduce((s, k) => s + k.progress, 0) / krs.length
}

/** Enough structure + recent progress for manager checklist. */
export type Completeness =
  | 'missing'
  | 'thin'
  | 'stale'
  | 'on_track'
  | 'at_risk'
  | 'done'

export function assessCompleteness(opts: {
  hasObjective: boolean
  krs: KeyResult[]
  updatedAt: string | null
}): { status: Completeness; avg: number; krCount: number } {
  if (!opts.hasObjective) {
    return { status: 'missing', avg: 0, krCount: 0 }
  }
  const krs = opts.krs
  const avg = avgProgress(krs)
  if (krs.length < 2) {
    return { status: 'thin', avg, krCount: krs.length }
  }
  if (avg >= 0.8) return { status: 'done', avg, krCount: krs.length }
  if (avg < 0.3) return { status: 'at_risk', avg, krCount: krs.length }

  // Stale if no update in 45 days
  if (opts.updatedAt) {
    const t = Date.parse(opts.updatedAt)
    if (Number.isFinite(t) && Date.now() - t > 45 * 24 * 3600 * 1000) {
      return { status: 'stale', avg, krCount: krs.length }
    }
  }

  return { status: 'on_track', avg, krCount: krs.length }
}

export const COMPLETENESS_LABEL: Record<Completeness, string> = {
  missing: 'Chưa có OKR',
  thin: 'Thiếu KR (<2)',
  stale: 'Lâu chưa cập nhật',
  on_track: 'Đang đúng hướng',
  at_risk: 'Rủi ro thấp tiến độ',
  done: 'Đạt (≥80%)',
}
