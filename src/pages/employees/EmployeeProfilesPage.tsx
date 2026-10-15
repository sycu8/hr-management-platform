import { useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'

type Employee = {
  id: string
  code: string
  full_name: string
  email: string | null
  department: string
  title: string
  status: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; items: Employee[] }
  | { status: 'error'; message: string }

export function EmployeeProfilesPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchJson<{ items: Employee[] }>('/api/employees?status=active')
      .then((res) => {
        if (!cancelled) setState({ status: 'ok', items: res.items })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Không tải được danh sách',
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    return <div className="card empty">Chưa có nhân viên trong tổ chức.</div>
  }

  return (
    <div className="card">
      <h2>Hồ sơ cá nhân ({state.items.length})</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Họ tên</th>
              <th>Phòng ban</th>
              <th>Chức danh</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((e) => (
              <tr key={e.id}>
                <td className="mono">{e.code}</td>
                <td>{e.full_name}</td>
                <td>{e.department}</td>
                <td>{e.title}</td>
                <td>{e.email ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
