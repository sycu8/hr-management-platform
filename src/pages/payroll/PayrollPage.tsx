import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson } from '../../lib/api'
import { downloadTable } from '../../lib/exportTable'
import { vnd } from '../../lib/format'
import {
  LEGAL_REVIEW_STATUS,
  PAYROLL_STATUS,
  labelOf,
} from '../../lib/labels'

const PAYROLL_HEADERS = [
  'Mã NV',
  'Họ tên',
  'Phòng ban',
  'Thử việc',
  'Lương cơ bản',
  'Công hưởng',
  'Công chuẩn',
  'Lương theo công',
  'Phụ cấp',
  'Thưởng',
  'Gross',
  'BH NLĐ',
  'TNCN',
  'Thực nhận',
  'BH DN',
] as const

type Run = {
  id: string
  year_month: string
  status: string
  closed_at: string | null
  legal_review_status: string
  headcount: number | null
  gross: number | null
  pit: number | null
  net: number | null
  cost: number | null
  note: string | null
}

type Slip = {
  id: string
  employee_code: string
  employee_name: string
  department: string
  base: number | null
  paid_days: number | null
  std_days: number | null
  salary_days: number | null
  allow: number | null
  bonus: number | null
  gross: number
  employee_insurance: number
  pit: number
  net: number
  employer_insurance: number
  probation: boolean
}

function ymLabel(ym: string) {
  const [y, m] = ym.split('-')
  return `Tháng ${Number(m)}/${y}`
}

function statusTone(status: string) {
  if (status === 'closed') return 'good'
  if (status === 'draft') return 'warn'
  return ''
}

function legalTone(status: string) {
  if (status === 'approved') return 'good'
  if (status === 'rejected') return 'bad'
  return 'warn'
}

export function PayrollPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [slips, setSlips] = useState<Slip[]>([])
  const [ym, setYm] = useState('2026-09')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson<{ items: Run[] }>('/api/payroll/runs')
      .then((r) => {
        if (cancelled) return
        const items = r.items ?? []
        setRuns(items)
        if (items.length && !items.some((x) => x.year_month === ym)) {
          setYm(items[0].year_month)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Không tải được')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial runs load only
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchJson<{ items: Slip[] }>(`/api/payroll/payslips?ym=${ym}`)
      .then((s) => {
        if (cancelled) return
        setSlips(s.items ?? [])
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Không tải được')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ym])

  const selected = useMemo(
    () => runs.find((r) => r.year_month === ym) ?? null,
    [runs, ym],
  )

  const sums = useMemo(() => {
    return slips.reduce(
      (acc, r) => {
        acc.base += r.base ?? 0
        acc.salaryDays += r.salary_days ?? 0
        acc.allow += r.allow ?? 0
        acc.bonus += r.bonus ?? 0
        acc.gross += r.gross
        acc.bhEmp += r.employee_insurance
        acc.pit += r.pit
        acc.net += r.net
        acc.bhEr += r.employer_insurance
        return acc
      },
      {
        base: 0,
        salaryDays: 0,
        allow: 0,
        bonus: 0,
        gross: 0,
        bhEmp: 0,
        pit: 0,
        net: 0,
        bhEr: 0,
      },
    )
  }, [slips])

  if (loading && runs.length === 0) {
    return (
      <div className="stack">
        <p className="page-lead muted">Đang tải bảng lương…</p>
      </div>
    )
  }

  if (error && runs.length === 0) {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{error}</p>
      </div>
    )
  }

  const displayGross = selected?.gross ?? sums.gross
  const displayNet = selected?.net ?? sums.net
  const displayPit = selected?.pit ?? sums.pit
  const displayCost = selected?.cost ?? sums.gross + sums.bhEr

  function exportPayroll(format: 'csv' | 'excel') {
    const rows = slips.map((r) => [
      r.employee_code,
      r.employee_name,
      r.department,
      r.probation,
      r.base ?? '',
      r.paid_days ?? '',
      r.std_days ?? '',
      r.salary_days ?? '',
      r.allow ?? '',
      r.bonus ?? '',
      r.gross,
      r.employee_insurance,
      r.pit,
      r.net,
      r.employer_insurance,
    ])
    downloadTable(
      format,
      `bang-luong-${ym}`,
      `BL ${ym}`,
      [...PAYROLL_HEADERS],
      rows,
    )
  }

  return (
    <div className="stack">
      <p className="page-lead muted">
        Kỳ lương theo tháng — tổng gross / TNCN / thực nhận, trạng thái chốt và
        duyệt pháp lý policy. Công tác phí quyết toán chi riêng, không gộp vào
        bảng lương. Tải CSV / Excel về máy để đối chiếu hoặc gửi kế toán.
      </p>

      <div className="card table-card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Kỳ</th>
                <th>Trạng thái</th>
                <th>Headcount</th>
                <th>Tổng gross</th>
                <th>TNCN</th>
                <th>Thực nhận</th>
                <th>Pháp lý</th>
                <th>Đóng</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.id}
                  className={r.year_month === ym ? 'row-selected' : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setYm(r.year_month)}
                >
                  <td className="mono">{r.year_month}</td>
                  <td>
                    <span className={`status-pill ${statusTone(r.status)}`}>
                      {labelOf(PAYROLL_STATUS, r.status)}
                    </span>
                  </td>
                  <td className="mono">{r.headcount ?? '—'}</td>
                  <td className="mono">{r.gross != null ? vnd(r.gross) : '—'}</td>
                  <td className="mono">{r.pit != null ? vnd(r.pit) : '—'}</td>
                  <td className="mono">{r.net != null ? vnd(r.net) : '—'}</td>
                  <td>
                    <span
                      className={`status-pill ${legalTone(r.legal_review_status)}`}
                    >
                      {labelOf(LEGAL_REVIEW_STATUS, r.legal_review_status)}
                    </span>
                  </td>
                  <td className="mono">
                    {r.closed_at?.slice(0, 10) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong>{ymLabel(ym)}</strong>
        {selected ? (
          <span className={`status-pill ${statusTone(selected.status)}`}>
            {labelOf(PAYROLL_STATUS, selected.status)}
          </span>
        ) : null}
        {selected ? (
          <span
            className={`status-pill ${legalTone(selected.legal_review_status)}`}
          >
            {labelOf(LEGAL_REVIEW_STATUS, selected.legal_review_status)}
          </span>
        ) : null}
        <div className="sp" style={{ flex: 1 }} />
        <button
          type="button"
          className="btn ghost"
          disabled={slips.length === 0}
          onClick={() => exportPayroll('csv')}
        >
          Tải CSV
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={slips.length === 0}
          onClick={() => exportPayroll('excel')}
        >
          Tải Excel
        </button>
        <Link className="btn ghost" to={`/payroll/payslips?ym=${ym}`}>
          Phiếu lương
        </Link>
        <Link className="btn ghost" to={`/payroll/insurance?ym=${ym}`}>
          Bảo hiểm
        </Link>
        <Link className="btn ghost" to="/payroll/params">
          Tham số tính lương
        </Link>
      </div>

      <div className="grid g4">
        <div className="tile">
          <div className="v">{vnd(displayGross)}</div>
          <div className="muted small">Tổng thu nhập (gross)</div>
        </div>
        <div className="tile">
          <div className="v">{vnd(displayNet)}</div>
          <div className="muted small">Tổng thực nhận</div>
        </div>
        <div className="tile">
          <div className="v">{vnd(displayPit)}</div>
          <div className="muted small">Thuế TNCN khấu trừ</div>
        </div>
        <div className="tile">
          <div className="v">{vnd(displayCost)}</div>
          <div className="muted small">Chi phí công ty (gross + BH DN)</div>
        </div>
      </div>

      {selected?.note ? (
        <p className="muted small">{selected.note}</p>
      ) : null}

      <div className="card table-card">
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Lương cơ bản</th>
                <th>Công</th>
                <th>Lương theo công</th>
                <th>Phụ cấp</th>
                <th>Thưởng</th>
                <th>Gross</th>
                <th>BH (NLĐ)</th>
                <th>TNCN</th>
                <th>Thực nhận</th>
                <th>BH (DN)</th>
              </tr>
            </thead>
            <tbody>
              {slips.length === 0 ? (
                <tr>
                  <td colSpan={11} className="muted">
                    {selected?.status === 'draft'
                      ? 'Kỳ nháp — chưa có dòng lương chi tiết.'
                      : 'Không có dữ liệu lương kỳ này.'}
                  </td>
                </tr>
              ) : (
                slips.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.employee_name}</b>
                      <div className="muted small">
                        {r.employee_code} · {r.department}
                        {r.probation ? ' · thử việc' : ''}
                      </div>
                    </td>
                    <td className="mono">{vnd(r.base)}</td>
                    <td className="mono">
                      {r.paid_days != null && r.std_days != null
                        ? `${r.paid_days}/${r.std_days}`
                        : '—'}
                    </td>
                    <td className="mono">{vnd(r.salary_days)}</td>
                    <td className="mono">{vnd(r.allow)}</td>
                    <td className="mono">
                      {r.bonus ? vnd(r.bonus) : '—'}
                    </td>
                    <td className="mono">{vnd(r.gross)}</td>
                    <td className="mono">{vnd(r.employee_insurance)}</td>
                    <td className="mono">{vnd(r.pit)}</td>
                    <td className="mono">
                      <b>{vnd(r.net)}</b>
                    </td>
                    <td className="mono">{vnd(r.employer_insurance)}</td>
                  </tr>
                ))
              )}
              {slips.length > 0 ? (
                <tr>
                  <td>
                    <b>Tổng cộng ({slips.length} NV)</b>
                  </td>
                  <td className="mono">{vnd(sums.base)}</td>
                  <td />
                  <td className="mono">{vnd(sums.salaryDays)}</td>
                  <td className="mono">{vnd(sums.allow)}</td>
                  <td className="mono">{vnd(sums.bonus)}</td>
                  <td className="mono">
                    <b>{vnd(sums.gross)}</b>
                  </td>
                  <td className="mono">{vnd(sums.bhEmp)}</td>
                  <td className="mono">{vnd(sums.pit)}</td>
                  <td className="mono">
                    <b>{vnd(sums.net)}</b>
                  </td>
                  <td className="mono">{vnd(sums.bhEr)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted small">
        Lương theo công = LCB × công hưởng lương ÷ công chuẩn. BH NLĐ 10,5%
        (BHXH 8% + BHYT 1,5% + BHTN 1%) trên lương đóng, có trần. Thử việc chưa
        đóng BH. Policy pháp lý đang{' '}
        {selected
          ? labelOf(LEGAL_REVIEW_STATUS, selected.legal_review_status).toLowerCase()
          : '—'}
        .
      </p>
    </div>
  )
}
