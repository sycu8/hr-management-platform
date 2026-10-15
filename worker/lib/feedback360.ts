export const ROLE_KEYS = ['self', 'mgr', 'peer', 'report'] as const
export type RoleKey = (typeof ROLE_KEYS)[number]

export const ROLE_LABEL: Record<RoleKey, string> = {
  self: 'Tự đánh giá',
  mgr: 'Quản lý',
  peer: 'Đồng nghiệp',
  report: 'Cấp dưới',
}

export type FeedbackNormalized = {
  competencies: string[]
  /** scores[role][competencyIndex] */
  byRole: Record<RoleKey, number[]>
  /** Average per role */
  roleAvg: Record<RoleKey, number | null>
  /** Average per competency across roles that have data */
  competencyAvg: number[]
  overall: number | null
  comments: Partial<Record<RoleKey, string>>
}

export function parseCompetencies(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json) as unknown
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : []
  } catch {
    return []
  }
}

function asRole(key: string): RoleKey | null {
  const k = key.toLowerCase()
  if (k === 'self') return 'self'
  if (k === 'mgr' || k === 'manager') return 'mgr'
  if (k === 'peer') return 'peer'
  if (k === 'report' || k === 'reports' || k === 'direct') return 'report'
  return null
}

export function parseScores(
  scoresJson: string | null | undefined,
  competencies: string[],
): Record<RoleKey, number[]> {
  const empty = (): Record<RoleKey, number[]> => ({
    self: [],
    mgr: [],
    peer: [],
    report: [],
  })
  const out = empty()
  if (!scoresJson) return out
  try {
    const raw = JSON.parse(scoresJson) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
    const obj = raw as Record<string, unknown>

    for (const [key, val] of Object.entries(obj)) {
      const role = asRole(key)
      if (!role) continue
      if (Array.isArray(val)) {
        out[role] = val.map((n) =>
          typeof n === 'number' && Number.isFinite(n)
            ? Math.min(5, Math.max(0, n))
            : 0,
        )
      } else if (typeof val === 'number' && Number.isFinite(val)) {
        // Aggregate score — expand to all competencies equally
        const n = Math.min(5, Math.max(0, val))
        const len = Math.max(competencies.length, 1)
        out[role] = Array.from({ length: len }, () => n)
      }
    }
    return out
  } catch {
    return out
  }
}

export function parseComments(
  json: string | null | undefined,
): Partial<Record<RoleKey, string>> {
  if (!json) return {}
  try {
    const raw = JSON.parse(json) as unknown
    if (!raw || typeof raw !== 'object') return {}
    const out: Partial<Record<RoleKey, string>> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const role = asRole(k)
      if (role && typeof v === 'string' && v.trim()) out[role] = v.trim()
    }
    return out
  } catch {
    return {}
  }
}

function avg(nums: number[]): number | null {
  const ok = nums.filter((n) => typeof n === 'number' && Number.isFinite(n))
  if (ok.length === 0) return null
  return ok.reduce((s, n) => s + n, 0) / ok.length
}

export function normalizeFeedback(opts: {
  competencies_json: string
  scores_json: string
  comments_json?: string | null
}): FeedbackNormalized {
  const competencies = parseCompetencies(opts.competencies_json)
  const byRole = parseScores(opts.scores_json, competencies)
  const n = Math.max(
    competencies.length,
    ...ROLE_KEYS.map((r) => byRole[r].length),
    1,
  )
  // Pad competencies if missing labels
  while (competencies.length < n) {
    competencies.push(`Năng lực ${competencies.length + 1}`)
  }
  for (const role of ROLE_KEYS) {
    while (byRole[role].length < n && byRole[role].length > 0) {
      byRole[role].push(byRole[role][byRole[role].length - 1]!)
    }
  }

  const roleAvg = {} as Record<RoleKey, number | null>
  for (const role of ROLE_KEYS) {
    roleAvg[role] = avg(byRole[role])
  }

  const competencyAvg: number[] = []
  for (let i = 0; i < n; i++) {
    const vals = ROLE_KEYS.map((r) => byRole[r][i]).filter(
      (x): x is number => typeof x === 'number',
    )
    competencyAvg.push(avg(vals) ?? 0)
  }

  const overall = avg(
    ROLE_KEYS.map((r) => roleAvg[r]).filter(
      (x): x is number => typeof x === 'number',
    ),
  )

  return {
    competencies,
    byRole,
    roleAvg,
    competencyAvg,
    overall,
    comments: parseComments(opts.comments_json),
  }
}
