import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchJson } from '../../lib/api'
import { vnd } from '../../lib/format'

type InsRow = {
  id: string
  employee_code: string
  employee_name: string
  department: string
  probation: boolean
  bh_base: number | null
  bhtn_base: number | null
  bhxh_emp: number | null
  bhyt_emp: number | null
  bhtn_emp: number | null
  bh_emp: number
  bhxh_er: number | null
  bhyt_er: number | null
  bhtn_er: number | null
  bh_er: number
  year_month: string
  run_status: string
}

type InsSummary = {
  employee_total: number
  employer_total: number
  grand_total: number
  headcount: number
  participating: number
}

type Doc = {
  id: string
  type_name: string
  file_name: string
  issued_on: string | null
  employee_name: string
  employee_code: string
}

function ymLabel(ym: string) {
  const [y, m] = ym.split('-')
  return `Tháng ${Number(m)}/${y}`
}

export function InsurancePage() {
  const [params, setParams] = useSearchParams()
  const ym = params.get('ym') || '2026-09'
  const [items, setItems] = useState<InsRow[]>([])
  const [summary, setSummary] = useState<InsSummary | null>(null)
  const [months, setMonths] = useState<string[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchJson<{
        items: InsRow[]
        summary: InsSummary
        ym: string
      }>(`/api/payroll/insurance?ym=${ym}`),
      fetchJson<{ items: { year_month: string }[] }>('/api/payroll/runs'),
      fetchJson<{ items: Doc[] }>('/api/lists/documents?type=Sổ BHXH'),
    ])
      .then(([ins, runs, d]) => {
        if (cancelled) return
        setItems(ins.items ?? [])
        setSummary(ins.summary)
        setMonths((runs.items ?? []).map((x) => x.year_month))
        setDocs(d.items ?? [])
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

  if (loading) {
    return (
      <div className="stack">
        <p className="page-lead muted">Đang tải bảo hiểm XH/YT…</p>
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
        Tổng hợp đóng BHXH / BHYT / BHTN theo kỳ lương (từ phiếu lương). Hồ sơ sổ
        BHXH đính kèm là tài liệu hỗ trợ, không thay bảng đóng.
      </p>

      <div className="card policy-card">
        <h2>Chính sách đóng (từ 01/07/2026)</h2>
        <ul className="plain-list">
          <li>
            Tỷ lệ: NLĐ <b>10,5%</b> · DN <b>21,5%</b> (BHXH 14% + ốm đau 3% +
            TNLĐ 0,5% + BHYT 3% + BHTN 1%) — Luật BHXH 2024, NĐ 188/2025, Luật
            Việc làm 2025
          </li>
          <li>
            Trần BHXH/BHYT: <b>20 × 2.530.000 ₫ = 50.600.000 ₫</b> (NĐ
            161/2026/NĐ-CP — mức lương cơ sở)
          </li>
          <li>
            Trần BHTN: <b>20 × lương tối thiểu vùng</b> — demo vùng I{' '}
            <b>5.310.000 ₫ → 106.200.000 ₫</b> (Luật Việc làm 2025 + NĐ
            293/2025/NĐ-CP) — xem thư viện Pháp lý
          </li>
        </ul>
      </div>

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

      {summary ? (
        <div className="grid g4">
          <div className="tile">
            <div className="v">{vnd(summary.employee_total)}</div>
            <div className="muted small">Người lao động đóng</div>
          </div>
          <div className="tile">
            <div className="v">{vnd(summary.employer_total)}</div>
            <div className="muted small">Doanh nghiệp đóng</div>
          </div>
          <div className="tile">
            <div className="v">{vnd(summary.grand_total)}</div>
            <div className="muted small">Tổng nộp bảo hiểm</div>
          </div>
          <div className="tile">
            <div className="v">
              {summary.participating}/{summary.headcount}
            </div>
            <div className="muted small">Người đang tham gia</div>
          </div>
        </div>
      ) : null}

      <div className="card table-card">
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Cơ sở BHXH/BHYT</th>
                <th>Cơ sở BHTN</th>
                <th>BHXH 8%</th>
                <th>BHYT 1,5%</th>
                <th>BHTN 1%</th>
                <th>NLĐ</th>
                <th>BHXH DN</th>
                <th>BHYT 3%</th>
                <th>BHTN 1%</th>
                <th>DN</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="muted">
                    Không có dữ liệu bảo hiểm kỳ này (kỳ nháp có thể chưa tính).
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.employee_name}</b>
                      <div className="muted small">
                        {r.employee_code} · {r.department}
                      </div>
                      {r.probation ? (
                        <div className="small warn-text">
                          Thử việc, chưa đóng
                        </div>
                      ) : null}
                    </td>
                    <td className="mono">{vnd(r.bh_base)}</td>
                    <td className="mono">
                      {vnd(r.bhtn_base ?? r.bh_base)}
                    </td>
                    <td className="mono">{vnd(r.bhxh_emp)}</td>
                    <td className="mono">{vnd(r.bhyt_emp)}</td>
                    <td className="mono">{vnd(r.bhtn_emp)}</td>
                    <td className="mono">
                      <b>{vnd(r.bh_emp)}</b>
                    </td>
                    <td className="mono">{vnd(r.bhxh_er)}</td>
                    <td className="mono">{vnd(r.bhyt_er)}</td>
                    <td className="mono">{vnd(r.bhtn_er)}</td>
                    <td className="mono">
                      <b>{vnd(r.bh_er)}</b>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted small">
        Tổng đóng 32% trên cơ sở tính. BHXH/BHYT và BHTN có thể khác cơ sở khi
        lương vượt trần BHXH/BHYT nhưng còn dưới trần BHTN theo vùng.
      </p>

      <div className="card">
        <h2>Hồ sơ sổ BHXH (tài liệu hỗ trợ)</h2>
        {docs.length === 0 ? (
          <p className="muted">Chưa có tệp sổ BHXH đính kèm.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Nhân viên</th>
                  <th>Loại</th>
                  <th>Tệp</th>
                  <th>Cấp</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{d.employee_code}</td>
                    <td>{d.employee_name}</td>
                    <td>{d.type_name}</td>
                    <td>{d.file_name}</td>
                    <td className="mono">{d.issued_on ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
