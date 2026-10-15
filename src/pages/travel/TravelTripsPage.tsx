import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildEstimateJson,
  TravelCalcPanel,
  type TravelCalcInputs,
} from '../../components/TravelCalcPanel'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ZONE_OPTIONS } from '../../lib/travel'

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
  estimate_json?: string | null
}

type EmpOpt = { id: string; code: string; full_name: string; level: number }

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pm: 'Chờ QL',
  ph: 'Chờ HR',
  ap: 'Đã duyệt',
  st: 'Quyết toán',
  ok: 'Hoàn tất',
  rj: 'Từ chối',
}

const STATUS_TONE: Record<string, string> = {
  draft: 'info',
  pm: 'warn',
  ph: 'warn',
  ap: 'good',
  st: 'warn',
  ok: 'good',
  rj: 'bad',
}

const EMPTY: Partial<Trip> = {
  origin: 'Hà Nội',
  destination: '',
  zone: 'dn2',
  purpose: '',
  start_at: '',
  end_at: '',
  distance_km: 0,
  transport: 'Máy bay',
  transport_est: 0,
  other_est: 0,
  other_note: '',
  hotel_mode: 'actual',
  hotel_price: 0,
  meal: 'none',
  advance: 0,
  status: 'draft',
}

function toLocalInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(v: string): string {
  if (!v) return ''
  return new Date(v).toISOString()
}

export function TravelTripsPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Trip[]>([])
  const [emps, setEmps] = useState<EmpOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<Trip> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [empLevel, setEmpLevel] = useState(1)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

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

  useEffect(() => {
    if (!canEdit) return
    fetchJson<{ items: EmpOpt[] }>('/api/employees?status=active&limit=300')
      .then((r) => setEmps(r.items ?? []))
      .catch(() => setEmps([]))
  }, [canEdit])

  const calcInputs: TravelCalcInputs = useMemo(
    () => ({
      zone: editing?.zone ?? 'dn3',
      start: editing?.start_at
        ? toLocalInput(editing.start_at)
        : '',
      end: editing?.end_at ? toLocalInput(editing.end_at) : '',
      distance: Number(editing?.distance_km ?? 0),
      meal: editing?.meal ?? 'none',
      hotelMode: editing?.hotel_mode ?? 'actual',
      hotelPrice: Number(editing?.hotel_price ?? 0),
      transportEst: Number(editing?.transport_est ?? 0),
      otherEst: Number(editing?.other_est ?? 0),
      level: empLevel,
      advance: Number(editing?.advance ?? 0),
    }),
    [editing, empLevel],
  )

  function openCreate() {
    setMsg(null)
    setCreating(true)
    setEditId(null)
    const first = emps[0]
    setEmpLevel(first?.level ?? 1)
    setEditing({
      ...EMPTY,
      employee_id: first?.id ?? user?.employeeId ?? '',
    })
  }

  async function openEdit(id: string) {
    setMsg(null)
    setCreating(false)
    setEditId(id)
    const res = await fetchJson<{ trip: Trip }>(`/api/trips/${id}`)
    setEditing(res.trip)
    const emp = emps.find((e) => e.id === res.trip.employee_id)
    setEmpLevel(emp?.level ?? 1)
  }

  async function save(e: React.FormEvent, submit: boolean) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setMsg(null)
    const status = submit
      ? editing.status === 'draft' || !editing.status
        ? 'pm'
        : editing.status
      : creating
        ? 'draft'
        : (editing.status ?? 'draft')

    const payload = {
      employee_id: editing.employee_id,
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
      hotel_mode: (editing.hotel_mode as 'actual' | 'flat' | 'none') ?? 'actual',
      hotel_price: Number(editing.hotel_price ?? 0),
      meal: (editing.meal as 'none' | 'partial' | 'full') ?? 'none',
      advance: Number(editing.advance ?? 0),
      status,
      estimate_json: buildEstimateJson(calcInputs),
    }

    try {
      if (creating) {
        await fetchJson('/api/trips', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      } else if (editId) {
        await fetchJson(`/api/trips/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      }
      setEditing(null)
      setEditId(null)
      setCreating(false)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        (STATUS_LABEL[r.status] ?? r.status).toLowerCase().includes(q),
    )
  }, [items, filter])

  if (editing) {
    return (
      <div className="stack">
        <nav className="crumb" aria-label="Breadcrumb">
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setEditing(null)
              setEditId(null)
              setCreating(false)
            }}
          >
            Đề nghị công tác
          </button>
          <span>/</span>
          <span>{creating ? 'Tạo mới' : editing.code ?? 'Sửa'}</span>
        </nav>

        <div className="split-form">
          <div className="card">
            <h2>
              {creating
                ? 'Tạo đề nghị công tác'
                : `Sửa đề nghị ${editing.code ?? ''}`}
            </h2>
            {msg ? <p className="warn-text">{msg}</p> : null}

            <ol className="trip-steps" aria-label="Các bước">
              <li className="on">1. Thông tin chuyến</li>
              <li className="on">2. Chi phí ước tính</li>
              <li>{creating ? '3. Gửi duyệt' : '3. Cập nhật'}</li>
            </ol>

            <form className="hr-form" onSubmit={(e) => void save(e, false)}>
              <fieldset>
                <legend>Hành trình</legend>
                <div className="form-grid">
                  {canEdit && creating ? (
                    <label className="span2">
                      Nhân viên
                      <select
                        value={editing.employee_id ?? ''}
                        onChange={(e) => {
                          const id = e.target.value
                          const emp = emps.find((x) => x.id === id)
                          setEmpLevel(emp?.level ?? 1)
                          setEditing({ ...editing, employee_id: id })
                        }}
                        required
                      >
                        <option value="">— Chọn —</option>
                        {emps.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.code} · {e.full_name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
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
                    Vùng chính sách
                    <select
                      value={editing.zone ?? 'dn2'}
                      onChange={(e) =>
                        setEditing({ ...editing, zone: e.target.value })
                      }
                    >
                      {ZONE_OPTIONS.map((z) => (
                        <option key={z.value} value={z.value}>
                          {z.label}
                        </option>
                      ))}
                    </select>
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
                      value={toLocalInput(editing.start_at)}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          start_at: fromLocalInput(e.target.value),
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Kết thúc
                    <input
                      type="datetime-local"
                      value={toLocalInput(editing.end_at)}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          end_at: fromLocalInput(e.target.value),
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Khoảng cách (km)
                    <input
                      type="number"
                      min={0}
                      value={editing.distance_km ?? 0}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          distance_km: Number(e.target.value),
                        })
                      }
                    />
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
                </div>
              </fieldset>

              <fieldset>
                <legend>Chi phí &amp; tạm ứng</legend>
                <div className="form-grid">
                  <label>
                    Ước tính VT (₫)
                    <input
                      type="number"
                      min={0}
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
                      min={0}
                      value={editing.other_est ?? 0}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          other_est: Number(e.target.value),
                        })
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
                      <option value="actual">Theo hóa đơn / đêm</option>
                      <option value="flat">Khoán</option>
                      <option value="none">Không</option>
                    </select>
                  </label>
                  <label>
                    Giá KS / đêm (₫)
                    <input
                      type="number"
                      min={0}
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
                    Ăn (trừ phụ cấp)
                    <select
                      value={editing.meal ?? 'none'}
                      onChange={(e) =>
                        setEditing({ ...editing, meal: e.target.value })
                      }
                    >
                      <option value="none">Không trừ</option>
                      <option value="partial">Một phần</option>
                      <option value="full">Đầy đủ</option>
                    </select>
                  </label>
                  <label>
                    Tạm ứng (₫)
                    <input
                      type="number"
                      min={0}
                      value={editing.advance ?? 0}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          advance: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  {!creating ? (
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
                  ) : null}
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
              </fieldset>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn primary"
                  disabled={saving}
                >
                  {saving
                    ? 'Đang lưu…'
                    : creating
                      ? 'Lưu nháp'
                      : 'Lưu'}
                </button>
                {creating ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={saving}
                    onClick={(e) => void save(e, true)}
                  >
                    Gửi duyệt
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setEditing(null)
                    setEditId(null)
                    setCreating(false)
                  }}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>

          <TravelCalcPanel inputs={calcInputs} />
        </div>
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
      <div className="toolbar">
        <div>
          <h2>Đề nghị công tác ({items.length})</h2>
          <p className="muted page-lead">
            {canEdit
              ? 'Tạo / sửa đề nghị — dự toán chi phí cập nhật theo chính sách.'
              : 'Danh sách đề nghị công tác của bạn.'}
          </p>
        </div>
        {canEdit ? (
          <button type="button" className="btn primary" onClick={openCreate}>
            + Tạo đề nghị
          </button>
        ) : null}
      </div>

      <div className="toolbar filters">
        <input
          className="search"
          placeholder="Lọc mã, điểm đến, mục đích…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="chip-row">
          {Object.entries(STATUS_LABEL).map(([k, v]) => {
            const n = items.filter((t) => t.status === k).length
            if (!n) return null
            return (
              <button
                key={k}
                type="button"
                className={`chip${filter === v ? ' on' : ''}`}
                onClick={() => setFilter(filter === v ? '' : v)}
              >
                {v} · {n}
              </button>
            )
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">Không có dữ liệu</p>
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
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.code}</td>
                  <td>{r.destination}</td>
                  <td>{r.purpose}</td>
                  <td className="mono">{r.start_at.slice(0, 10)}</td>
                  <td className="mono">{r.end_at.slice(0, 10)}</td>
                  <td>
                    <span
                      className={`status-pill ${STATUS_TONE[r.status] ?? ''}`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
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
