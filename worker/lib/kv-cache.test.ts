import { describe, expect, it } from 'vitest'
import { dashSummaryCacheKey, dashTravelCacheKey } from './kv-cache.ts'

describe('kv-cache keys', () => {
  it('scopes summary by org and day', () => {
    expect(dashSummaryCacheKey('org_demo', '2026-10-15')).toBe(
      'dash:summary:v2:org_demo:2026-10-15',
    )
  })

  it('scopes travel by org', () => {
    expect(dashTravelCacheKey('org_demo')).toBe('dash:travel:v2:org_demo')
  })
})
