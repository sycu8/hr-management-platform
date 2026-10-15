import { describe, expect, it } from 'vitest'
import type { AuthUser } from './auth.ts'
import { CAPABILITY_TO_MODULE } from '../env.ts'

/**
 * Mirrors levelFromAccount / listAllowedModules logic without D1 —
 * guards against reintroducing per-module capability re-queries.
 */
function levelsForUser(
  accountType: AuthUser['accountType'],
  caps: { capability: string; level: number }[],
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const row of caps) {
    const mod =
      CAPABILITY_TO_MODULE[row.capability as keyof typeof CAPABILITY_TO_MODULE]
    if (!mod) continue
    map[mod] = Math.max(map[mod] ?? 0, row.level)
  }

  const modules = [
    'dash',
    'emp',
    'rec',
    'leave',
    'trip',
    'pay',
    'perf',
    'learn',
    'pol',
    'sys',
  ] as const

  const out: Record<string, number> = {}
  for (const mod of modules) {
    if (accountType === 'super_admin') {
      out[mod] = 2
      continue
    }
    if (accountType === 'admin') {
      out[mod] = mod === 'sys' ? 1 : 2
      continue
    }
    out[mod] = mod === 'dash' ? 1 : (map[mod] ?? 0)
  }
  return out
}

describe('module levels from one capability pass', () => {
  it('gives admin full business modules and sys read', () => {
    const levels = levelsForUser('admin', [])
    expect(levels.emp).toBe(2)
    expect(levels.sys).toBe(1)
    expect(levels.dash).toBe(2)
  })

  it('gives user dash plus granted caps only', () => {
    const levels = levelsForUser('user', [
      { capability: 'employees', level: 1 },
      { capability: 'leave', level: 2 },
      { capability: 'benefits', level: 1 },
    ])
    expect(levels.dash).toBe(1)
    expect(levels.emp).toBe(1)
    expect(levels.leave).toBe(2)
    expect(levels.pay).toBe(1) // benefits → pay
    expect(levels.pol).toBe(0)
    expect(levels.sys).toBe(0)
  })

  it('maps all allowed modules without N queries', () => {
    const levels = levelsForUser('user', [
      { capability: 'recruiting', level: 1 },
      { capability: 'learning', level: 1 },
    ])
    const allowed = Object.entries(levels)
      .filter(([, v]) => v > 0)
      .map(([k]) => k)
      .sort()
    expect(allowed).toEqual(['dash', 'learn', 'rec'])
  })
})
