import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type Trip = {
  id: string
  code: string
  employee_id: string
  origin: string
  destination: string
  zone: string
  start_at: string
  end_at: string
  status: string
  purpose: string
  advance: number
  transport: string
  distance_km: number
  transport_est?: number
  other_est?: number
  other_note?: string | null
  hotel_mode?: string
  hotel_price?: number
  meal?: string
  reject_note?: string | null
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

export function TravelTripsPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<Trip> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchJson<{ items: Trip[] }>('/api/trips')
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

  async function openEdit(id: string) {
    setMsg(null)
    setEditId(id)
    const res = await fetchJson<{ trip: Trip }>(`/api/trips/${id}`)
    setEditing(res.trip)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!editing || !editId) return
    setSaving(true)
    setMsg(null)
    try {
      await fetchJson(`/api/trips/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          origin: editing.origin,
          destination: editing.destination,
          zone: editing.zone,
          purpose: editing.purpose,
          start_at: editing.start_at,
          end_at: editing.end_at,
          distance_km: Number(editing.distance_km ?? 0),
          transport: editing.transport,
          transport_est: Number(editing.transport_est ?? 0),
          other_est: Number(editing.other_est ?? 0),
          other_note: editing.other_note ?? null,
          hotel_mode: editing.hotel_mode as 'actual' | 'flat' | 'none' | undefined,
          hotel_price: Number(editing.hotel_price ?? 0),
          meal: editing.meal as 'none' | 'partial' | 'full' | undefined,
          advance: Number(editing.advance ?? 0),
          status: editing.status as Trip['status'],
        }),
      })
      setEditing(null)
      setEditId(null)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="card">
        <h2>Sửa đề nghị công tác {editing.code ?? ''}</h2>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void save(e)}>
          <div className="form-grid">
            <label>
              Điểm đi
              <input
                value={editing.origin ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, origin: e.target.value })
                }
                required
              />
            </label>
            <label>
              Điểm đến
              <input
                value={editing.destination ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, destination: e.target.value })
                }
                required
              />
            </label>
            <label>
              Vùng
              <input
                value={editing.zone ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, zone: e.target.value })
                }
              />
            </label>
            <label>
              Phương tiện
              <input
                value={editing.transport ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, transport: e.target.value })
                }
              />
            </label>
            <label>
              Bắt đầu
              <input
                type="datetime-local"
                value={(editing.start_at ?? '').slice(0, 16)}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    start_at: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : '',
                  })
                }
              />
            </label>
            <label>
              Kết thúc
              <input
                type="datetime-local"
                value={(editing.end_at ?? '').slice(0, 16)}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    end_at: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : '',
                  })
                }
              />
            </label>
            <label>
              Km
              <input
                type="number"
                value={editing.distance_km ?? 0}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    distance_km: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Tạm ứng (₫)
              <input
                type="number"
                value={editing.advance ?? 0}
                onChange={(e) =>
                  setEditing({ ...editing, advance: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Ước tính VT (₫)
              <input
                type="number"
                value={editing.transport_est ?? 0}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    transport_est: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Chi phí khác (₫)
              <input
                type="number"
                value={editing.other_est ?? 0}
                onChange={(e) =>
                  setEditing({ ...editing, other_est: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Khách sạn
              <select
                value={editing.hotel_mode ?? 'actual'}
                onChange={(e) =>
                  setEditing({ ...editing, hotel_mode: e.target.value })
                }
              >
                <option value="actual">Theo hóa đơn</option>
                <option value="flat">Khoán</option>
                <option value="none">Không</option>
              </select>
            </label>
            <label>
              Giá KS (₫)
              <input
                type="number"
                value={editing.hotel_price ?? 0}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    hotel_price: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Ăn
              <select
                value={editing.meal ?? 'none'}
                onChange={(e) =>
                  setEditing({ ...editing, meal: e.target.value })
                }
              >
                <option value="none">Không</option>
                <option value="partial">Một phần</option>
                <option value="full">Đầy đủ</option>
              </select>
            </label>
            <label>
              Trạng thái
              <select
                value={editing.status ?? 'draft'}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value })
                }
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="span2">
              Mục đích
              <textarea
                rows={2}
                value={editing.purpose ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, purpose: e.target.value })
                }
                required
              />
            </label>
            <label className="span2">
              Ghi chú chi phí khác
              <input
                value={editing.other_note ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, other_note: e.target.value })
                }
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setEditing(null)
                setEditId(null)
              }}
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
        <h2>Đề nghị công tác</h2>
        <p>Đang tải…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Đề nghị công tác</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Đề nghị công tác ({items.length})</h2>
      <p className="muted">
        {canEdit
          ? 'Admin / Super Admin có thể chỉnh sửa thông tin & phí công tác.'
          : 'Danh sách đề nghị công tác.'}
      </p>
      {items.length === 0 ? (
        <p>Không có dữ liệu</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Điểm đến</th>
                <th>Mục đích</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
                <th>TT</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.code}</td>
                  <td>{r.destination}</td>
                  <td>{r.purpose}</td>
                  <td>{r.start_at.slice(0, 10)}</td>
                  <td>{r.end_at.slice(0, 10)}</td>
                  <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => void openEdit(r.id)}
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
