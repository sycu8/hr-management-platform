import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type UserRow = {
  id: string
  email: string
  display_name: string | null
  account_type: string
  employee_id: string | null
  is_active: number
  last_login_at: string | null
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; items: UserRow[] }
  | { status: 'error'; message: string }

export function PermissionsPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setState({ status: 'loading' })
    fetchJson<{ items: UserRow[] }>('/api/users')
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

  async function toggleActive(row: UserRow) {
    if (!canEdit) return
    if (row.account_type === 'super_admin' && user?.accountType !== 'super_admin') {
      setMsg('Không thể khóa tài khoản Super Admin')
      return
    }
    setBusyId(row.id)
    setMsg(null)
    try {
      await fetchJson(`/api/users/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.is_active }),
      })
      load()
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Không cập nhật được')
    } finally {
      setBusyId(null)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="card empty">
        <h2>Phân quyền người dùng</h2>
        <p>Đang tải…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="card empty">
        <h2>Phân quyền người dùng</h2>
        <p>{state.message}</p>
      </div>
    )
  }

  if (state.items.length === 0) {
    return (
      <div className="card empty">
        <h2>Phân quyền người dùng</h2>
        <p>Không có dữ liệu</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Phân quyền người dùng ({state.items.length})</h2>
      <p className="muted">
        Admin được sửa thông tin / khóa tài khoản user. Tích hợp nguồn dữ liệu chỉ
        dành cho Super Admin.
      </p>
      {msg ? <p className="warn-text">{msg}</p> : null}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Email</th>
              <th>Tên</th>
              <th>Loại TK</th>
              <th>Trạng thái</th>
              <th>NV</th>
              <th>Đăng nhập gần nhất</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {state.items.map((row) => (
              <tr key={row.id}>
                <td>{row.email}</td>
                <td>{row.display_name ?? '—'}</td>
                <td>{row.account_type}</td>
                <td>{row.is_active ? 'Hoạt động' : 'Khóa'}</td>
                <td>{row.employee_id ?? '—'}</td>
                <td>
                  {row.last_login_at?.slice(0, 16).replace('T', ' ') ?? '—'}
                </td>
                {canEdit ? (
                  <td>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busyId === row.id}
                      onClick={() => void toggleActive(row)}
                    >
                      {row.is_active ? 'Khóa' : 'Mở'}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
