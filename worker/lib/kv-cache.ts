import type { Env } from '../env.ts'

/**
 * Short-lived KV JSON cache for expensive read aggregates.
 * Keys must include org (and user when data is scoped).
 */
export async function kvGetJson<T>(
  env: Env,
  key: string,
): Promise<T | null> {
  if (!env.CACHE) return null
  try {
    return (await env.CACHE.get(key, 'json')) as T | null
  } catch {
    return null
  }
}

export async function kvPutJson(
  env: Env,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!env.CACHE) return
  try {
    await env.CACHE.put(key, JSON.stringify(value), {
      expirationTtl: Math.max(60, ttlSeconds),
    })
  } catch {
    /* ignore cache write failures */
  }
}

/** Fire-and-forget put via waitUntil when available. */
export function kvPutJsonBackground(
  env: Env,
  ctx: { waitUntil?: (p: Promise<unknown>) => void } | undefined,
  key: string,
  value: unknown,
  ttlSeconds: number,
): void {
  const task = kvPutJson(env, key, value, ttlSeconds)
  if (ctx?.waitUntil) ctx.waitUntil(task)
  else void task
}

export function dashSummaryCacheKey(orgId: string, dayIso: string): string {
  return `dash:summary:v2:${orgId}:${dayIso}`
}

export function dashTravelCacheKey(orgId: string): string {
  return `dash:travel:v2:${orgId}`
}
