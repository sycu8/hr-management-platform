import type { Env } from '../env.ts'

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; reason: string }

type SiteverifyResponse = {
  success?: boolean
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

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

/**
 * Canonical Turnstile Siteverify gate.
 * Fail closed on missing secret/hostnames, network errors, or mismatched action/hostname.
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

  if (!secret || hosts.size === 0) {
    return { ok: false, reason: 'Turnstile not configured' }
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

  const hostname = (result.hostname ?? '').toLowerCase()
  if (
    result.success !== true ||
    result.action !== opts.expectedAction ||
    !hosts.has(hostname)
  ) {
    return { ok: false, reason: 'Turnstile verification failed' }
  }

  return { ok: true }
}
