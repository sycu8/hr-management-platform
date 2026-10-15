import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type DataSource = {
  id: string
  name: string
  kind: string
  description: string
  enabled: boolean
  updatedAt: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; items: DataSource[] }
  | { status: 'error'; message: string }

/**
 * Data-source integrations — Super Admin only.
 * Admin (HR) cannot connect or toggle external sources.
 */
export function IntegrationsPage() {
  const { user } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    kind: 'Khác',
    description: '',
  })
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setState({ status: 'loading' })
    fetchJson<{ items: DataSource[] }>('/api/data-sources')
      .then((res) => setState({ status: 'ok', items: res.items ?? [] }))
      .catch((err: unknown) =>
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Không tải được',
        }),
      )
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!user?.canManageDataSources) {
    return (
      <div className="card empty">
        <h2>Tích hợp nguồn dữ liệu</h2>
        <p>Chỉ Super Admin được cấu hình nguồn thông tin / tích hợp hệ thống.</p>
      </div>
    )
  }

  async function toggle(ds: DataSource) {
    setBusyId(ds.id)
    setMsg(null)
    try {
      await fetchJson(`/api/data-sources/${ds.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !ds.enabled }),
      })
      load()
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Không cập nhật được')
    } finally {
      setBusyId(null)
    }
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    try {
      await fetchJson('/api/data-sources', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          kind: form.kind.trim(),
          description: form.description.trim(),
          enabled: false,
        }),
      })
      setForm({ name: '', kind: 'Khác', description: '' })
      load()
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Không tạo được')
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="card empty">
        <h2>Tích hợp nguồn dữ liệu</h2>
        <p>Đang tải…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="card empty">
        <h2>Tích hợp nguồn dữ liệu</h2>
        <p>{state.message}</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>Tích hợp nguồn dữ liệu ({state.items.length})</h2>
        <p className="muted">
          Chỉ Super Admin được bật/tắt hoặc thêm nguồn. Admin (HR) chỉnh sửa hồ sơ
          nhân sự và tài khoản, không cấu hình tích hợp.
        </p>
        {msg ? <p className="warn-text">{msg}</p> : null}
        {state.items.length === 0 ? (
          <p>Không có dữ liệu</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Tên nguồn</th>
                  <th>Loại</th>
                  <th>Mô tả</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.items.map((ds) => (
                  <tr key={ds.id}>
                    <td>{ds.name}</td>
                    <td>{ds.kind}</td>
                    <td>{ds.description || '—'}</td>
                    <td>{ds.enabled ? 'Đang bật' : 'Tắt'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={busyId === ds.id}
                        onClick={() => void toggle(ds)}
                      >
                        {ds.enabled ? 'Tắt' : 'Bật'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Thêm nguồn dữ liệu</h2>
        <form className="form-grid" onSubmit={(e) => void addSource(e)}>
          <label>
            Tên
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label>
            Loại
            <input
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              required
            />
          </label>
          <label className="span2">
            Mô tả
            <input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
          <button type="submit" className="btn primary">
            Thêm nguồn
          </button>
        </form>
      </div>
    </div>
  )
}
