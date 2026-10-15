import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

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

export function LeaveRequestPage() {
  const { user } = useAuth()
  const canDecide = !!user?.canEditData
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

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
    <div className="card">
      <h2>Đăng ký nghỉ phép ({items.length})</h2>
      <p className="muted">
        {canDecide
          ? 'Admin / Super Admin: duyệt hoặc từ chối lịch nghỉ đang chờ.'
          : 'Danh sách đơn nghỉ phép.'}
      </p>
      {msg ? <p className="warn-text">{msg}</p> : null}
      {items.length === 0 ? (
        <p>Không có dữ liệu</p>
      ) : (
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
                <th>TT</th>
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
                    {r.status}
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
      )}
    </div>
  )
}
