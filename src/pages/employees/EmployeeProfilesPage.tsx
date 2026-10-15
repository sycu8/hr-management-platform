import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type Employee = {
  id: string
  code: string
  full_name: string
  email: string | null
  department: string
  title: string
  status: string
  phone?: string | null
  address?: string | null
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; items: Employee[] }
  | { status: 'error'; message: string }

export function EmployeeProfilesPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [editing, setEditing] = useState<Employee | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setState({ status: 'loading' })
    fetchJson<{ items: Employee[] }>('/api/employees?status=active')
      .then((res) => setState({ status: 'ok', items: res.items }))
      .catch((e: unknown) =>
        setState({
          status: 'error',
          message: e instanceof Error ? e.message : 'Không tải được danh sách',
        }),
      )
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function openEdit(row: Employee) {
    setErr(null)
    try {
      const detail = await fetchJson<{ employee: Employee }>(
        `/api/employees/${row.id}`,
      )
      setEditing(detail.employee)
    } catch {
      setEditing(row)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setErr(null)
    try {
      await fetchJson(`/api/employees/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: editing.full_name,
          email: editing.email,
          phone: editing.phone ?? null,
          department: editing.department,
          title: editing.title,
          address: editing.address ?? null,
        }),
      })
      setEditing(null)
      load()
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (state.status === 'loading') {
    return <div className="card empty">Đang tải hồ sơ nhân viên…</div>
  }

  if (state.status === 'error') {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{state.message}</p>
      </div>
    )
  }

  if (state.items.length === 0) {
    return (
      <div className="card empty">
        <h2>Hồ sơ cá nhân</h2>
        <p>Không có dữ liệu</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>Hồ sơ cá nhân ({state.items.length})</h2>
        {canEdit ? (
          <p className="muted">Admin / Super Admin có thể sửa thông tin nhân viên.</p>
        ) : null}
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Họ tên</th>
                <th>Phòng ban</th>
                <th>Chức danh</th>
                <th>Email</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {state.items.map((emp) => (
                <tr key={emp.id}>
                  <td className="mono">{emp.code}</td>
                  <td>{emp.full_name}</td>
                  <td>{emp.department}</td>
                  <td>{emp.title}</td>
                  <td>{emp.email ?? '—'}</td>
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => void openEdit(emp)}
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
      </div>

      {editing ? (
        <div className="card">
          <h2>Sửa hồ sơ — {editing.code}</h2>
          {err ? <p className="warn-text">{err}</p> : null}
          <form className="form-grid" onSubmit={(e) => void saveEdit(e)}>
            <label>
              Họ tên
              <input
                value={editing.full_name}
                onChange={(e) =>
                  setEditing({ ...editing, full_name: e.target.value })
                }
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={editing.email ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, email: e.target.value || null })
                }
              />
            </label>
            <label>
              Điện thoại
              <input
                value={editing.phone ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, phone: e.target.value || null })
                }
              />
            </label>
            <label>
              Phòng ban
              <input
                value={editing.department}
                onChange={(e) =>
                  setEditing({ ...editing, department: e.target.value })
                }
                required
              />
            </label>
            <label>
              Chức danh
              <input
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
                required
              />
            </label>
            <label className="span2">
              Địa chỉ
              <input
                value={editing.address ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, address: e.target.value || null })
                }
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setEditing(null)}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
