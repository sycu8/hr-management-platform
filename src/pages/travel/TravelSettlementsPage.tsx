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
  actual_json?: string | null
  estimate_json?: string | null
}

type SettleForm = {
  id: string
  code: string
  hotel: number
  transport: number
  other: number
  note: string
  total: number
  advance: number
}

const STATUS_LABEL: Record<string, string> = {
  ap: 'Đã duyệt',
  st: 'Đang quyết toán',
  ok: 'Hoàn tất',
}

export function TravelSettlementsPage() {
  const { user } = useAuth()
  const canSettle = !!user?.canEditData
  const [items, setItems] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<SettleForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchJson<{ items: Trip[] }>('/api/trips?pipeline=settle')
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

  async function openSettle(id: string) {
    setMsg(null)
    const res = await fetchJson<{ trip: Trip }>(`/api/trips/${id}`)
    const t = res.trip
    let actual: Record<string, number | string> = {}
    try {
      actual = t.actual_json
        ? (JSON.parse(t.actual_json) as Record<string, number | string>)
        : {}
    } catch {
      actual = {}
    }
    const hotel = Number(actual.hotel ?? 0)
    const transport = Number(actual.transport ?? 0)
    const other = Number(actual.other ?? 0)
    const total = Number(actual.total ?? hotel + transport + other)
    setForm({
      id: t.id,
      code: t.code,
      hotel,
      transport,
      other,
      note: String(actual.note ?? ''),
      total,
      advance: t.advance ?? 0,
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setMsg(null)
    const total =
      form.total || form.hotel + form.transport + form.other
    try {
      await fetchJson(`/api/trips/${form.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({
          hotel: form.hotel,
          transport: form.transport,
          other: form.other,
          note: form.note,
          total,
        }),
      })
      setForm(null)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không quyết toán được')
    } finally {
      setSaving(false)
    }
  }

  if (form) {
    const computed = form.hotel + form.transport + form.other
    const balance = computed - form.advance
    return (
      <div className="card">
        <h2>Quyết toán {form.code}</h2>
        <p className="muted">
          Tạm ứng đã cấp: {form.advance.toLocaleString('vi-VN')} ₫ — chênh lệch:{' '}
          {balance.toLocaleString('vi-VN')} ₫
        </p>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void save(e)}>
          <div className="form-grid">
            <label>
              Khách sạn thực tế (₫)
              <input
                type="number"
                value={form.hotel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hotel: Number(e.target.value),
                    total: 0,
                  })
                }
              />
            </label>
            <label>
              Vận chuyển thực tế (₫)
              <input
                type="number"
                value={form.transport}
                onChange={(e) =>
                  setForm({
                    ...form,
                    transport: Number(e.target.value),
                    total: 0,
                  })
                }
              />
            </label>
            <label>
              Chi phí khác (₫)
              <input
                type="number"
                value={form.other}
                onChange={(e) =>
                  setForm({
                    ...form,
                    other: Number(e.target.value),
                    total: 0,
                  })
                }
              />
            </label>
            <label>
              Tổng quyết toán (₫)
              <input
                type="number"
                value={form.total || computed}
                onChange={(e) =>
                  setForm({ ...form, total: Number(e.target.value) })
                }
              />
            </label>
            <label className="span2">
              Ghi chú quyết toán
              <textarea
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Hoàn tất quyết toán'}
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
        <h2>Quyết toán</h2>
        <p>Đang tải…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Quyết toán</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Quyết toán công tác ({items.length})</h2>
      <p className="muted">
        {canSettle
          ? 'Admin / Super Admin nhập chi phí thực tế và hoàn tất quyết toán.'
          : 'Danh sách chuyến chờ / đang quyết toán.'}
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
                <th>Tạm ứng</th>
                <th>TT</th>
                {canSettle ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr
                  key={r.id}
                  className={r.status !== 'ok' ? 'row-warn' : undefined}
                >
                  <td className="mono">{r.code}</td>
                  <td>{r.destination}</td>
                  <td>{r.purpose}</td>
                  <td>{r.start_at.slice(0, 10)}</td>
                  <td className="mono">
                    {(r.advance ?? 0).toLocaleString('vi-VN')} ₫
                  </td>
                  <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                  {canSettle ? (
                    <td>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => void openSettle(r.id)}
                      >
                        Quyết toán
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
