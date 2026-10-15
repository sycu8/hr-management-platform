import type { Env } from '../env.ts'

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; reason: string }

type SiteverifyResponse = {
  success?: boolean
  action?: string
  hostname?: string
  'error-codes'?: string[]
  metadata?: { result_with_testing_key?: boolean }
}

/** Cloudflare published always-pass secret — local/e2e only, never production. */
export const TURNSTILE_ALWAYS_PASS_SECRET =
  '1x0000000000000000000000000000000AA'

const LOCAL_ONLY_HOSTS = new Set(['localhost', '127.0.0.1'])

function resolveSecret(env: Env): string | undefined {
  const secret = env.TURNSTILE_SECRET ?? env.TURNSTILE_SECRET_KEY
  return typeof secret === 'string' && secret.trim() ? secret.trim() : undefined
}

function expectedHostnames(env: Env): Set<string> {
  return new Set(
    (env.TURNSTILE_HOSTNAMES ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** Test keys only when every configured hostname is local (never prod). */
export function allowTurnstileTestingKeys(hosts: Set<string>): boolean {
  if (hosts.size === 0) return false
  for (const h of hosts) {
    if (!LOCAL_ONLY_HOSTS.has(h)) return false
  }
  return true
}

/**
 * Canonical Turnstile Siteverify gate.
 * Fail closed on missing secret/hostnames, network errors, or mismatched action/hostname.
 * Always-pass / testing-key responses are accepted only for localhost-only host configs.
 */
export async function verifyTurnstileToken(opts: {
  env: Env
  token: unknown
  expectedAction: string
  remoteIp?: string | null
}): Promise<TurnstileVerifyResult> {
  const secret = resolveSecret(opts.env)
  const hosts = expectedHostnames(opts.env)
  const token = opts.token
  const localTestOk = allowTurnstileTestingKeys(hosts)

  if (!secret || hosts.size === 0) {
    return { ok: false, reason: 'Turnstile not configured' }
  }

  // Never allow Cloudflare always-pass secret on non-local host configs.
  if (secret === TURNSTILE_ALWAYS_PASS_SECRET && !localTestOk) {
    return { ok: false, reason: 'Turnstile test secret not allowed' }
  }

  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return { ok: false, reason: 'Missing Turnstile token' }
  }

  let result: SiteverifyResponse
  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    })
    if (opts.remoteIp) body.set('remoteip', opts.remoteIp)

    const r = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(10_000),
        body,
      },
    )
    if (!r.ok) return { ok: false, reason: `siteverify ${r.status}` }
    result = (await r.json()) as SiteverifyResponse
  } catch {
    return { ok: false, reason: 'siteverify unreachable' }
  }

  if (result.success !== true) {
    return { ok: false, reason: 'Turnstile verification failed' }
  }

  const testingKey =
    secret === TURNSTILE_ALWAYS_PASS_SECRET ||
    result.metadata?.result_with_testing_key === true

  if (testingKey) {
    if (!localTestOk) {
      return { ok: false, reason: 'Turnstile testing key rejected' }
    }
    // Dummy Siteverify responses use hostname example.com and omit action.
    return { ok: true }
  }

  const hostname = (result.hostname ?? '').toLowerCase()
  if (result.action !== opts.expectedAction || !hosts.has(hostname)) {
    return { ok: false, reason: 'Turnstile verification failed' }
  }

  return { ok: true }
}
