import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson } from '../../lib/api'

type Item = { kind?: string; title: string; when: string; detail: string }

type Summary = {
  upcoming: Item[]
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: Summary }
  | { status: 'error'; message: string }

export function EventsPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchJson<Summary>('/api/dashboard/summary')
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Không tải được',
          })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return <div className="card empty">Đang tải sự kiện…</div>
  }
  if (state.status === 'error') {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{state.message}</p>
      </div>
    )
  }

  const items = state.data.upcoming ?? []

  return (
    <div className="stack dash">
      <div className="dash-intro">
        <div>
          <h1 className="dash-title">Sự kiện sắp tới</h1>
          <p className="muted">
            Nghỉ phép đã duyệt và công tác trong 21 ngày tới.
          </p>
        </div>
        <div className="dash-actions">
          <Link className="btn ghost" to="/leave/calendar">
            Lịch nghỉ
          </Link>
          <Link className="btn ghost" to="/travel/trips">
            Công tác
          </Link>
        </div>
      </div>
      <div className="card">
        {items.length === 0 ? (
          <p className="empty">Không có sự kiện sắp tới.</p>
        ) : (
          <ul className="feed-list">
            {items.map((u, i) => (
              <li key={`${u.title}-${u.when}-${i}`}>
                <div className="feed-when">{u.when}</div>
                <div>
                  <span className="muted small">
                    {u.kind === 'trip' ? 'Công tác' : 'Nghỉ phép'}
                  </span>
                  <div>
                    <strong>{u.title}</strong>
                  </div>
                  <div className="muted small">{u.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
