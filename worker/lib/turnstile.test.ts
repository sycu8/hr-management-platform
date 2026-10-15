import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../env.ts'
import {
  TURNSTILE_ALWAYS_PASS_SECRET,
  allowTurnstileTestingKeys,
  verifyTurnstileToken,
} from './turnstile.ts'

function env(partial: Partial<Env> = {}): Env {
  return {
    TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    TURNSTILE_SECRET: TURNSTILE_ALWAYS_PASS_SECRET,
    TURNSTILE_HOSTNAMES: 'localhost,127.0.0.1',
    ...partial,
  } as Env
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('allowTurnstileTestingKeys', () => {
  it('allows only when every host is local', () => {
    expect(allowTurnstileTestingKeys(new Set(['localhost']))).toBe(true)
    expect(
      allowTurnstileTestingKeys(new Set(['localhost', '127.0.0.1'])),
    ).toBe(true)
    expect(
      allowTurnstileTestingKeys(new Set(['localhost', 'hrm.orangecloud.vn'])),
    ).toBe(false)
    expect(allowTurnstileTestingKeys(new Set(['hrm.orangecloud.vn']))).toBe(
      false,
    )
  })
})

describe('verifyTurnstileToken', () => {
  it('accepts Cloudflare always-pass siteverify on local-only hosts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          hostname: 'example.com',
          metadata: { result_with_testing_key: true },
          'error-codes': [],
        }),
      ),
    )

    const result = await verifyTurnstileToken({
      env: env(),
      token: 'XXXX.DUMMY.TOKEN.XXXX',
      expectedAction: 'login',
    })
    expect(result).toEqual({ ok: true })
  })

  it('rejects always-pass secret when production hostnames configured', async () => {
    const result = await verifyTurnstileToken({
      env: env({
        TURNSTILE_HOSTNAMES: 'hrm.orangecloud.vn',
        TURNSTILE_SECRET: TURNSTILE_ALWAYS_PASS_SECRET,
      }),
      token: 'XXXX.DUMMY.TOKEN.XXXX',
      expectedAction: 'login',
    })
    expect(result).toEqual({
      ok: false,
      reason: 'Turnstile test secret not allowed',
    })
  })

  it('rejects testing-key metadata when hosts are not local-only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          hostname: 'example.com',
          metadata: { result_with_testing_key: true },
        }),
      ),
    )

    const result = await verifyTurnstileToken({
      env: env({
        TURNSTILE_SECRET: 'prod-secret-not-test',
        TURNSTILE_HOSTNAMES: 'hrm.orangecloud.vn',
      }),
      token: 'real-token',
      expectedAction: 'login',
    })
    expect(result).toEqual({
      ok: false,
      reason: 'Turnstile testing key rejected',
    })
  })

  it('rejects production-like responses with wrong hostname', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          action: 'login',
          hostname: 'evil.example',
        }),
      ),
    )

    const result = await verifyTurnstileToken({
      env: env({
        TURNSTILE_SECRET: 'prod-secret-not-test',
        TURNSTILE_HOSTNAMES: 'hrm.orangecloud.vn',
      }),
      token: 'real-token',
      expectedAction: 'login',
    })
    expect(result).toEqual({ ok: false, reason: 'Turnstile verification failed' })
  })

  it('accepts matching action + hostname for real secrets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          action: 'login',
          hostname: 'hrm.orangecloud.vn',
        }),
      ),
    )

    const result = await verifyTurnstileToken({
      env: env({
        TURNSTILE_SECRET: 'prod-secret-not-test',
        TURNSTILE_HOSTNAMES: 'hrm.orangecloud.vn',
      }),
      token: 'real-token',
      expectedAction: 'login',
    })
    expect(result).toEqual({ ok: true })
  })
})
