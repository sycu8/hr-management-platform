import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { LEAVE_STATUS, labelOf } from '../../lib/labels'

type Leave = {
  id: string
  employee_name: string
  employee_code: string
  leave_type: string
  start_date: string
  end_date: string
  working_days: number
  status: string
  reason: string
  reject_note?: string | null
}

const LEAVE_TYPES = [
  { value: 'annual', label: 'Phép năm' },
  { value: 'sick', label: 'Ốm' },
  { value: 'special', label: 'Đặc biệt' },
  { value: 'unpaid', label: 'Không lương' },
] as const

export function LeaveRequestPage() {
  const { user } = useAuth()
  const canDecide = !!user?.canEditData
  const canCreate = !!user?.employeeId || canDecide
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
  })

  const load = useCallback(() => {
    setLoading(true)
    fetchJson<{ items: Leave[] }>('/api/lists/leave-requests')
      .then((r) => {
        setItems(r.items ?? [])
        setError(null)
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Không tải được'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function decide(id: string, status: 'approved' | 'rejected') {
    setBusy(id)
    setMsg(null)
    try {
      const reject_note =
        status === 'rejected'
          ? window.prompt('Lý do từ chối', 'Không phù hợp lịch đội') ?? 'Từ chối'
          : undefined
      await fetchJson(`/api/leave/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reject_note }),
      })
      load()
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Không duyệt được')
    } finally {
      setBusy(null)
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      await fetchJson('/api/leave/requests', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setCreateOpen(false)
      setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không tạo được đơn')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card empty">
        <h2>Đăng ký nghỉ phép</h2>
        <p>Đang tải…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Đăng ký nghỉ phép</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="stack">
      {createOpen ? (
        <div className="card">
          <h2>Xin nghỉ phép</h2>
          {msg ? <p className="warn-text">{msg}</p> : null}
          <form className="form-grid" onSubmit={(e) => void submitCreate(e)}>
            <label>
              Loại
              <select
                value={form.leave_type}
                onChange={(e) =>
                  setForm({ ...form, leave_type: e.target.value })
                }
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ ngày
              <input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
                required
              />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                required
              />
            </label>
            <label className="span2">
              Lý do
              <input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                required
                maxLength={500}
              />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Đang gửi…' : 'Gửi đơn'}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setCreateOpen(false)}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="card">
        <div className="toolbar">
          <div>
            <h2>Đăng ký nghỉ phép ({items.length})</h2>
            <p className="muted">
              {canDecide
                ? 'Admin / Super Admin: duyệt hoặc từ chối lịch nghỉ đang chờ.'
                : 'Tạo và theo dõi đơn nghỉ phép của bạn.'}
            </p>
          </div>
          {canCreate && !createOpen ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => setCreateOpen(true)}
            >
              + Xin nghỉ phép
            </button>
          ) : null}
        </div>
        {msg && !createOpen ? <p className="warn-text">{msg}</p> : null}
        {items.length === 0 ? (
          <p>Không có dữ liệu</p>
        ) : (
          <div className="card table-card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Nhân viên</th>
                    <th>Loại</th>
                    <th>Từ</th>
                    <th>Đến</th>
                    <th>Ngày</th>
                    <th>Lý do</th>
                    <th>Trạng thái</th>
                    {canDecide ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr
                      key={r.id}
                      className={r.status === 'pending' ? 'row-warn' : undefined}
                    >
                      <td className="mono">{r.employee_code}</td>
                      <td>{r.employee_name}</td>
                      <td>{r.leave_type}</td>
                      <td>{r.start_date}</td>
                      <td>{r.end_date}</td>
                      <td className="mono">{r.working_days}</td>
                      <td>{r.reason}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            r.status === 'pending'
                              ? 'warn'
                              : r.status === 'approved'
                                ? 'good'
                                : r.status === 'rejected'
                                  ? 'bad'
                                  : ''
                          }`}
                        >
                          {labelOf(LEAVE_STATUS, r.status)}
                        </span>
                        {r.reject_note ? (
                          <div className="muted small">{r.reject_note}</div>
                        ) : null}
                      </td>
                      {canDecide ? (
                        <td className="actions-cell">
                          {r.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                className="btn primary"
                                disabled={busy === r.id}
                                onClick={() => void decide(r.id, 'approved')}
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                className="btn ghost"
                                disabled={busy === r.id}
                                onClick={() => void decide(r.id, 'rejected')}
                              >
                                Từ chối
                              </button>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
