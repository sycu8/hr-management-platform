const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export type TurnstileApi = {
  render: (
    el: string | HTMLElement,
    options: {
      sitekey: string
      action?: string
      theme?: 'light' | 'dark' | 'auto'
      callback?: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
    },
  ) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
  getResponse: (widgetId?: string) => string
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null

export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile requires a browser'))
  }
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-hrm-turnstile]',
    )
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.turnstile) resolve(window.turnstile)
        else reject(new Error('Turnstile failed to load'))
      })
      existing.addEventListener('error', () =>
        reject(new Error('Turnstile script error')),
      )
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.dataset.hrmTurnstile = '1'
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile failed to load'))
    }
    script.onerror = () => reject(new Error('Turnstile script error'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

export async function fetchTurnstileConfig(): Promise<{
  siteKey: string
  action: string
}> {
  const res = await fetch('/api/auth/turnstile', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Không tải được cấu hình xác minh')
  return (await res.json()) as { siteKey: string; action: string }
}
