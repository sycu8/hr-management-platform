import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchJson } from '../../lib/api'
import { vnd } from '../../lib/format'
import { PAYROLL_STATUS, labelOf } from '../../lib/labels'

type Slip = {
  id: string
  year_month: string
  employee_code: string
  employee_name: string
  department: string
  title: string | null
  base: number | null
  paid_days: number | null
  std_days: number | null
  salary_days: number | null
  allow: number | null
  bonus: number | null
  gross: number
  employee_insurance: number
  bhxh_emp: number | null
  bhyt_emp: number | null
  bhtn_emp: number | null
  pit: number
  net: number
  employer_insurance: number
  run_status: string
  probation: boolean
  trip: number
  taxable: number | null
  dependents: number | null
  exempt: number | null
  ents: Array<{ type?: string; kind?: string; amount?: number; title?: string }>
}

function ymLabel(ym: string) {
  const [y, m] = ym.split('-')
  return `Tháng ${Number(m)}/${y}`
}

export function PayslipsPage() {
  const [params, setParams] = useSearchParams()
  const ym = params.get('ym') || '2026-09'
  const [items, setItems] = useState<Slip[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Slip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ items: Slip[] }>(`/api/payroll/payslips?ym=${ym}`),
      fetchJson<{ items: { year_month: string }[] }>('/api/payroll/runs'),
    ])
      .then(([s, r]) => {
        setItems(s.items ?? [])
        setMonths((r.items ?? []).map((x) => x.year_month))
        setError(null)
        setSelectedId(null)
        setDetail(null)
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Không tải được'),
      )
      .finally(() => setLoading(false))
  }, [ym])

  useEffect(() => {
    load()
  }, [load])

  async function openDetail(id: string) {
    setSelectedId(id)
    try {
      const res = await fetchJson<{ payslip: Slip }>(
        `/api/payroll/payslips/${id}`,
      )
      setDetail(res.payslip)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không mở được phiếu')
    }
  }

  const selected = useMemo(
    () => detail ?? items.find((x) => x.id === selectedId) ?? null,
    [detail, items, selectedId],
  )

  if (loading) {
    return (
      <div className="stack">
        <p className="page-lead muted">Đang tải phiếu lương…</p>
      </div>
    )
  }

  if (error && items.length === 0) {
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
        Phiếu lương điện tử — LCB, công, phụ cấp/thưởng, gross, BH NLĐ (BHXH /
        BHYT / BHTN), TNCN và thực nhận. Công tác phí quyết toán chi riêng.
      </p>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {(months.length ? months : [ym]).map((m) => (
          <button
            key={m}
            type="button"
            className={`btn ${m === ym ? 'primary' : 'ghost'}`}
            onClick={() => setParams({ ym: m })}
          >
            {ymLabel(m)}
          </button>
        ))}
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Họ tên</th>
                <th>Phòng</th>
                <th>LCB</th>
                <th>Công</th>
                <th>Lương theo công</th>
                <th>PC</th>
                <th>Thưởng</th>
                <th>Gross</th>
                <th>BHXH</th>
                <th>BHYT</th>
                <th>BHTN</th>
                <th>TNCN</th>
                <th>Thực nhận</th>
                <th>BH DN</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr
                  key={r.id}
                  className={r.id === selectedId ? 'row-selected' : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={() => void openDetail(r.id)}
                >
                  <td className="mono">{r.employee_code}</td>
                  <td>
                    {r.employee_name}
                    {r.probation ? (
                      <div className="muted small">Thử việc</div>
                    ) : null}
                  </td>
                  <td>{r.department}</td>
                  <td className="mono">{vnd(r.base)}</td>
                  <td className="mono">
                    {r.paid_days != null && r.std_days != null
                      ? `${r.paid_days}/${r.std_days}`
                      : '—'}
                  </td>
                  <td className="mono">{vnd(r.salary_days)}</td>
                  <td className="mono">{vnd(r.allow)}</td>
                  <td className="mono">{r.bonus ? vnd(r.bonus) : '—'}</td>
                  <td className="mono">{vnd(r.gross)}</td>
                  <td className="mono">{vnd(r.bhxh_emp)}</td>
                  <td className="mono">{vnd(r.bhyt_emp)}</td>
                  <td className="mono">{vnd(r.bhtn_emp)}</td>
                  <td className="mono">{vnd(r.pit)}</td>
                  <td className="mono">
                    <b>{vnd(r.net)}</b>
                  </td>
                  <td className="mono">{vnd(r.employer_insurance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <div className="card" style={{ maxWidth: 760 }}>
          <div
            className="row"
            style={{ marginBottom: 8, alignItems: 'flex-start', gap: 12 }}
          >
            <div style={{ flex: 1 }}>
              <div className="muted small">
                PHIẾU LƯƠNG {ymLabel(selected.year_month).toUpperCase()}
              </div>
              <h2 style={{ margin: '4px 0' }}>{selected.employee_name}</h2>
              <div className="muted small">
                {selected.employee_code}
                {selected.title ? ` · ${selected.title}` : ''} ·{' '}
                {selected.department}
              </div>
            </div>
            <span
              className={`status-pill ${
                selected.run_status === 'closed' ? 'good' : 'warn'
              }`}
            >
              {labelOf(PAYROLL_STATUS, selected.run_status)}
            </span>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setSelectedId(null)
                setDetail(null)
              }}
            >
              Đóng
            </button>
          </div>

          <h3>Thu nhập</h3>
          <table className="data">
            <tbody>
              <tr>
                <td>
                  Lương theo ngày công{' '}
                  <span className="muted small">
                    ({vnd(selected.base)} × {selected.paid_days}/
                    {selected.std_days})
                  </span>
                </td>
                <td className="mono">{vnd(selected.salary_days)}</td>
              </tr>
              {(selected.ents ?? []).map((a, i) => (
                <tr key={`${a.type ?? a.title}-${i}`}>
                  <td>
                    {a.type ?? a.title}
                    {a.kind === 'bonus' ? (
                      <span className="muted small"> (thưởng)</span>
                    ) : null}
                  </td>
                  <td className="mono">{vnd(a.amount)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <b>Tổng thu nhập</b>
                </td>
                <td className="mono">
                  <b>{vnd(selected.gross)}</b>
                </td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>Khấu trừ</h3>
          <table className="data">
            <tbody>
              {selected.probation ? (
                <tr>
                  <td>Bảo hiểm</td>
                  <td className="muted">Chưa đóng (thử việc)</td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td>BHXH 8%</td>
                    <td className="mono">{vnd(selected.bhxh_emp)}</td>
                  </tr>
                  <tr>
                    <td>BHYT 1,5%</td>
                    <td className="mono">{vnd(selected.bhyt_emp)}</td>
                  </tr>
                  <tr>
                    <td>BHTN 1%</td>
                    <td className="mono">{vnd(selected.bhtn_emp)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td>Thuế thu nhập cá nhân</td>
                <td className="mono">{vnd(selected.pit)}</td>
              </tr>
              <tr>
                <td>
                  <b>Tổng khấu trừ</b>
                </td>
                <td className="mono">
                  <b>
                    {vnd(selected.employee_insurance + selected.pit)}
                  </b>
                </td>
              </tr>
            </tbody>
          </table>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '14px 0',
              borderTop: '2px solid var(--ink, #1a1a1a)',
              marginTop: 10,
            }}
          >
            <b>Thực nhận</b>
            <b style={{ fontSize: 26, fontVariantNumeric: 'tabular-nums' }}>
              {vnd(selected.net)}
            </b>
          </div>

          <h3>Ngày công</h3>
          <div className="grid g3" style={{ marginTop: 6 }}>
            <div className="tile">
              <div className="v" style={{ fontSize: 20 }}>
                {selected.std_days ?? '—'}
              </div>
              <div className="muted small">Công chuẩn</div>
            </div>
            <div className="tile">
              <div className="v" style={{ fontSize: 20 }}>
                {selected.paid_days ?? '—'}
              </div>
              <div className="muted small">Công hưởng lương</div>
            </div>
            <div className="tile">
              <div className="v" style={{ fontSize: 20 }}>
                {vnd(selected.employer_insurance)}
              </div>
              <div className="muted small">BH doanh nghiệp</div>
            </div>
          </div>

          {selected.trip ? (
            <p className="muted" style={{ marginTop: 12 }}>
              Công tác phí đã quyết toán trong tháng:{' '}
              <b>{vnd(selected.trip)}</b>. Khoản này chi riêng theo quy chế công
              tác phí, không tính vào lương.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="muted small">Chọn một dòng để xem phiếu lương chi tiết.</p>
      )}
    </div>
  )
}
