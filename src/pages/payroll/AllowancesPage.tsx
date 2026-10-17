import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { vnd } from '../../lib/format'
import { EARNING_KIND, labelOf } from '../../lib/labels'

type Earning = {
  id: string
  year_month: string
  kind: string
  title: string
  amount: number
  taxable: number | boolean
  note: string | null
  employee_name: string | null
  employee_code: string | null
  employee_id?: string | null
}

type EmpOpt = { id: string; code: string; full_name: string }

const emptyForm = {
  employee_id: 'all',
  year_month: '2026-09',
  kind: 'bonus' as 'allowance' | 'bonus',
  title: '',
  amount: '',
  taxable: true,
  note: '',
}

export function AllowancesPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Earning[]>([])
  const [emps, setEmps] = useState<EmpOpt[]>([])
  const [kindFilter, setKindFilter] = useState<'all' | 'allowance' | 'bonus'>(
    'all',
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ items: Earning[] }>('/api/lists/earnings'),
      fetchJson<{ items: EmpOpt[] }>('/api/lists/job-profiles'),
    ])
      .then(([e, j]) => {
        setItems(e.items ?? [])
        setEmps(j.items ?? [])
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

  const filtered = useMemo(
    () =>
      kindFilter === 'all'
        ? items
        : items.filter((x) => x.kind === kindFilter),
    [items, kindFilter],
  )

  const total = useMemo(
    () => filtered.reduce((s, x) => s + x.amount, 0),
    [filtered],
  )

  async function addEarning(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    const amount = Number(form.amount)
    if (!form.title.trim() || !(amount > 0)) {
      setMsg('Nhập tên khoản và số tiền lớn hơn 0.')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await fetchJson('/api/payroll/earnings', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: form.employee_id === 'all' ? null : form.employee_id,
          year_month: form.year_month,
          kind: form.kind,
          title: form.title.trim(),
          amount: Math.round(amount),
          taxable: form.taxable,
          note: form.note.trim() || null,
        }),
      })
      setForm({ ...emptyForm, year_month: form.year_month, kind: form.kind })
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không thêm được')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!canEdit) return
    if (!window.confirm('Xóa khoản này?')) return
    setMsg(null)
    try {
      await fetchJson(`/api/payroll/earnings/${id}`, { method: 'DELETE' })
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không xóa được')
    }
  }

  if (loading) {
    return (
      <div className="stack">
        <p className="page-lead muted">Đang tải phụ cấp & thưởng…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <p className="page-lead muted">
        Phụ cấp và thưởng theo nhân viên hoặc toàn công ty — áp dụng hằng tháng
        (`*`) hoặc theo kỳ `yyyy-mm`. Khoản taxable ảnh hưởng TNCN khi chốt bảng
        lương.
      </p>

      <div className="card policy-card">
        <h2>Miễn thuế TNCN — tiền ăn giữa ca / ăn trưa</h2>
        <p>
          Từ <b>01/07/2026</b>, khoản tiền ăn giữa ca / ăn trưa chi{' '}
          <b>bằng tiền</b> được miễn thuế TNCN đến{' '}
          <b>1.200.000 ₫/người/tháng</b> (NĐ 253/2026/NĐ-CP Đ.8(2)(g)). Phần vượt
          mức tính vào thu nhập chịu thuế. Nếu DN tổ chức bữa ăn (nấu / suất ăn /
          phiếu ăn) thì không tính vào thu nhập chịu thuế.
        </p>
        <p className="muted small">
          Demo hiện chi phụ cấp «Ăn trưa» 730.000 ₫ — dưới trần miễn thuế mới;
          khi tăng mức chi, công thức lương đã dùng trần 1.200.000 ₫.
        </p>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {(
          [
            ['all', 'Tất cả'],
            ['allowance', 'Phụ cấp'],
            ['bonus', 'Thưởng'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`btn ${kindFilter === k ? 'primary' : 'ghost'}`}
            onClick={() => setKindFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {msg ? <p className="warn-text">{msg}</p> : null}

      <div className="card table-card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Đối tượng</th>
                <th>Khoản</th>
                <th>Loại</th>
                <th>Áp dụng</th>
                <th>Chịu thuế</th>
                <th>Số tiền</th>
                <th>Ghi chú</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="muted">
                    Không có khoản nào.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.employee_code ? (
                        <>
                          <b>{r.employee_name}</b>
                          <div className="muted small mono">{r.employee_code}</div>
                        </>
                      ) : (
                        'Toàn bộ nhân viên đang làm việc'
                      )}
                    </td>
                    <td>
                      <b>{r.title}</b>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          r.kind === 'bonus' ? 'good' : 'info'
                        }`}
                      >
                        {labelOf(EARNING_KIND, r.kind)}
                      </span>
                    </td>
                    <td className="mono">
                      {r.year_month === '*' ? 'Hằng tháng' : r.year_month}
                    </td>
                    <td>{r.taxable === 0 || r.taxable === false ? 'Không' : 'Có'}</td>
                    <td className="mono">{vnd(r.amount)}</td>
                    <td className="muted small">{r.note ?? '—'}</td>
                    {canEdit ? (
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => void remove(r.id)}
                        >
                          Xóa
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
              <tr>
                <td colSpan={5}>
                  <b>Tổng ({filtered.length} khoản)</b>
                  <span className="muted small">
                    {' '}
                    — khoản “toàn bộ NV” tính một lần trên danh sách
                  </span>
                </td>
                <td className="mono">
                  <b>{vnd(total)}</b>
                </td>
                <td colSpan={canEdit ? 2 : 1} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {canEdit ? (
        <div className="card">
          <h2>Thêm khoản</h2>
          <form className="form-grid" onSubmit={(e) => void addEarning(e)}>
            <label>
              Đối tượng
              <select
                value={form.employee_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, employee_id: e.target.value }))
                }
              >
                <option value="all">Toàn bộ nhân viên</option>
                {emps.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.code} — {emp.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Loại
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as 'allowance' | 'bonus',
                  }))
                }
              >
                <option value="allowance">Phụ cấp</option>
                <option value="bonus">Thưởng</option>
              </select>
            </label>
            <label>
              Tên khoản
              <input
                value={form.title}
                placeholder="Ví dụ: Thưởng dự án"
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>
            <label>
              Số tiền (₫)
              <input
                type="number"
                min={0}
                step={100000}
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </label>
            <label>
              Áp dụng
              <select
                value={form.year_month}
                onChange={(e) =>
                  setForm((f) => ({ ...f, year_month: e.target.value }))
                }
              >
                <option value="*">Hằng tháng</option>
                <option value="2026-08">2026-08</option>
                <option value="2026-09">2026-09</option>
                <option value="2026-10">2026-10</option>
              </select>
            </label>
            <label>
              Chịu thuế TNCN
              <select
                value={form.taxable ? '1' : '0'}
                onChange={(e) =>
                  setForm((f) => ({ ...f, taxable: e.target.value === '1' }))
                }
              >
                <option value="1">Có</option>
                <option value="0">Không</option>
              </select>
            </label>
            <label className="span2">
              Ghi chú
              <input
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </label>
            <div className="span2">
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Đang lưu…' : 'Thêm khoản'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="muted small">
          Chỉ Admin / Super Admin được thêm hoặc xóa phụ cấp & thưởng.
        </p>
      )}
    </div>
  )
}
