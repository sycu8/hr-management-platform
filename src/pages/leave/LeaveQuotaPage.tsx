import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type Quota = {
  id: string
  year: number
  days: number
  reason: string
  employee_name: string
  employee_code: string
  employee_id?: string
}

type Emp = { id: string; code: string; full_name: string }

export function LeaveQuotaPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const year = 2026
  const [items, setItems] = useState<Quota[]>([])
  const [emps, setEmps] = useState<Emp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<{
    id?: string
    employee_id: string
    days: number
    reason: string
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ items: Quota[] }>(`/api/lists/leave-quotas?year=${year}`),
      fetchJson<{ items: Emp[] }>('/api/employees?status=active&limit=200'),
    ])
      .then(([q, e]) => {
        setItems(q.items ?? [])
        setEmps(e.items ?? [])
        setError(null)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Không tải được'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setMsg(null)
    try {
      if (form.id) {
        await fetchJson(`/api/leave/quotas/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ days: form.days, reason: form.reason }),
        })
      } else {
        await fetchJson('/api/leave/quotas', {
          method: 'PUT',
          body: JSON.stringify({
            employee_id: form.employee_id,
            year,
            days: form.days,
            reason: form.reason,
          }),
        })
      }
      setForm(null)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (form) {
    return (
      <div className="card">
        <h2>{form.id ? 'Sửa số ngày phép' : 'Cộng / điều chỉnh ngày phép'}</h2>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="form-grid" onSubmit={(e) => void save(e)}>
          {!form.id ? (
            <label className="span2">
              Nhân viên
              <select
                value={form.employee_id}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
                required
              >
                <option value="">—</option>
                {emps.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.code} — {emp.full_name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Số ngày (±)
            <input
              type="number"
              step={0.5}
              value={form.days}
              onChange={(e) =>
                setForm({ ...form, days: Number(e.target.value) })
              }
              required
            />
          </label>
          <label className="span2">
            Lý do
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              Lưu
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setForm(null)}
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card empty">
        <h2>Hạn mức nghỉ phép</h2>
        <p>Đang tải…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Hạn mức nghỉ phép</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div>
          <h2>Hạn mức nghỉ phép {year} ({items.length})</h2>
          <p className="muted">
            Ngày cộng thêm (thâm niên / chuyển năm).{' '}
            {canEdit ? 'Admin / Super Admin được chỉnh.' : ''}
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              setForm({ employee_id: '', days: 1, reason: 'Thâm niên' })
            }
          >
            + Điều chỉnh
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p>Không có dữ liệu</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Nhân viên</th>
                <th>Năm</th>
                <th>Ngày cộng</th>
                <th>Lý do</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.employee_code}</td>
                  <td>{r.employee_name}</td>
                  <td className="mono">{r.year}</td>
                  <td className="mono">{r.days}</td>
                  <td>{r.reason}</td>
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() =>
                          setForm({
                            id: r.id,
                            employee_id: '',
                            days: r.days,
                            reason: r.reason,
                          })
                        }
                      >
                        Sửa
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
