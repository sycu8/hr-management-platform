import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type Trip = {
  id: string
  code: string
  destination: string
  purpose: string
  start_at: string
  end_at: string
  status: string
  advance: number
  origin: string
  zone: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pm: 'Chờ QL',
  ph: 'Chờ HR',
  ap: 'Đã duyệt',
  st: 'Quyết toán',
  ok: 'Hoàn tất',
  rj: 'Từ chối',
}

export function TravelApprovalsPage() {
  const { user } = useAuth()
  const canDecide = !!user?.canEditData
  const [items, setItems] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchJson<{ items: Trip[] }>('/api/trips?pipeline=approve')
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

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy(id)
    setMsg(null)
    try {
      const note =
        decision === 'reject'
          ? window.prompt('Lý do từ chối', 'Không phù hợp ngân sách / lịch') ??
            'Từ chối'
          : undefined
      await fetchJson(`/api/trips/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decision, note }),
      })
      load()
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Không phê duyệt được')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="card empty">
        <h2>Phê duyệt công tác</h2>
        <p>Đang tải…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Phê duyệt công tác</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Phê duyệt công tác ({items.length})</h2>
      <p className="muted">
        {canDecide
          ? 'Admin / Super Admin duyệt hoặc từ chối đề nghị đang chờ (QL / HR).'
          : 'Danh sách đề nghị chờ phê duyệt.'}
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
                <th>Tuyến</th>
                <th>Mục đích</th>
                <th>Bắt đầu</th>
                <th>Tạm ứng</th>
                <th>TT</th>
                {canDecide ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="row-warn">
                  <td className="mono">{r.code}</td>
                  <td>
                    {r.origin} → {r.destination}
                    {r.zone ? ` (${r.zone})` : ''}
                  </td>
                  <td>{r.purpose}</td>
                  <td>{r.start_at.slice(0, 10)}</td>
                  <td className="mono">
                    {(r.advance ?? 0).toLocaleString('vi-VN')} ₫
                  </td>
                  <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                  {canDecide ? (
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn primary"
                        disabled={busy === r.id}
                        onClick={() => void decide(r.id, 'approve')}
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={busy === r.id}
                        onClick={() => void decide(r.id, 'reject')}
                      >
                        Từ chối
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
