import { useEffect, useState, type ReactNode } from 'react'
import { fetchJson } from '../lib/api'

type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ok'; items: T[] }
  | { status: 'error'; message: string }

export function DataTablePage<T extends { id: string }>({
  title,
  endpoint,
  columns,
  emptyText = 'Không có dữ liệu',
  description,
}: {
  title: string
  endpoint: string
  columns: Column<T>[]
  emptyText?: string
  /** Optional intro under the topbar page title (avoid repeating title as h2). */
  description?: string
}) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchJson<{ items: T[] }>(endpoint)
      .then((res) => {
        if (!cancelled) setState({ status: 'ok', items: res.items ?? [] })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            err instanceof Error ? err.message : 'Không tải được dữ liệu',
        })
      })
    return () => {
      cancelled = true
    }
  }, [endpoint])

  if (state.status === 'loading') {
    return (
      <div className="stack">
        {description ? <p className="page-lead muted">{description}</p> : null}
        <div className="card empty">
          <p>Đang tải {title.toLowerCase()}…</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="stack">
        {description ? <p className="page-lead muted">{description}</p> : null}
        <div className="card empty">
          <h2>Không tải được dữ liệu</h2>
          <p>{state.message}</p>
        </div>
      </div>
    )
  }

  if (state.items.length === 0) {
    return (
      <div className="stack">
        {description ? <p className="page-lead muted">{description}</p> : null}
        <div className="card empty">
          <h2>{title}</h2>
          <p>{emptyText}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="table-head">
        {description ? <p className="page-lead muted">{description}</p> : null}
        <p className="table-meta muted">
          <strong>{state.items.length}</strong> bản ghi
        </p>
      </div>
      <div className="card table-card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.items.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.className}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
