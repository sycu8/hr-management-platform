import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  fetchTurnstileConfig,
  loadTurnstile,
  type TurnstileApi,
} from '../lib/turnstile'

export function LoginPage() {
  const { state, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [turnstileReady, setTurnstileReady] = useState(false)

  const widgetHostRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const turnstileRef = useRef<TurnstileApi | null>(null)

  useEffect(() => {
    let cancelled = false

    async function mount() {
      try {
        const [api, config] = await Promise.all([
          loadTurnstile(),
          fetchTurnstileConfig(),
        ])
        if (cancelled || !widgetHostRef.current) return
        turnstileRef.current = api
        if (widgetIdRef.current) {
          api.remove(widgetIdRef.current)
          widgetIdRef.current = null
        }
        widgetIdRef.current = api.render(widgetHostRef.current, {
          sitekey: config.siteKey,
          action: config.action,
          theme: 'light',
        })
        if (!cancelled) setTurnstileReady(true)
      } catch {
        if (!cancelled) {
          setError('Không tải được xác minh bảo mật. Tải lại trang.')
          setTurnstileReady(false)
        }
      }
    }

    void mount()
    return () => {
      cancelled = true
      if (widgetIdRef.current && turnstileRef.current) {
        turnstileRef.current.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="login-page">
        <div className="login-stage">
          <BrandMark />
          <p className="login-status">Đang kiểm tra phiên đăng nhập…</p>
        </div>
      </div>
    )
  }

  if (state.status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const api = turnstileRef.current
      const widgetId = widgetIdRef.current
      const token =
        api && widgetId != null ? api.getResponse(widgetId) : ''
      if (!token) {
        setError('Hãy hoàn thành xác minh bảo mật trước khi đăng nhập.')
        return
      }
      await login(email.trim(), password, token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Không đăng nhập được. Thử lại.',
      )
    } finally {
      const api = turnstileRef.current
      const widgetId = widgetIdRef.current
      if (api && widgetId != null) api.reset(widgetId)
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-stage">
        <BrandMark />
        <p className="login-tagline">
          Hệ thống nhân sự nội bộ cho tổ chức — nghỉ phép, công tác, lương và
          tuyển dụng trên một nền tảng.
        </p>

        <form className="login-form" onSubmit={onSubmit} noValidate>
          <h1 className="login-form-title">Đăng nhập</h1>

          <label className="f">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@orangecloud.vn"
            />
          </label>
          <label className="f">
            Mật khẩu
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          <div className="login-turnstile" aria-live="polite">
            <div ref={widgetHostRef} />
            {!turnstileReady && !error ? (
              <p className="login-turnstile-hint">Đang tải xác minh…</p>
            ) : null}
          </div>

          {error ? (
            <div className="login-error" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn primary login-submit"
            disabled={submitting || !turnstileReady}
          >
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <p className="login-foot">hrm.orangecloud.vn · Orange Cloud</p>
      </div>
    </div>
  )
}

function BrandMark() {
  return (
    <header className="login-brand">
      <img
        className="login-logo"
        src="/logo.svg"
        width={72}
        height={72}
        alt=""
      />
      <p className="login-product">HR Management Platform</p>
      <p className="login-org">Orange Cloud</p>
    </header>
  )
}
