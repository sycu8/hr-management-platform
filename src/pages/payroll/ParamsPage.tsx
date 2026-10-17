import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dec, vnd } from '../../lib/format'
import { LEGAL_REVIEW_STATUS, labelOf } from '../../lib/labels'

type PayBracket = [cap: number, rate: number]

type PayParams = {
  ref: number
  capMult: number
  bhtnRegionMin?: number
  bhtnCapMult?: number
  bhEmp: { bhxh: number; bhyt: number; bhtn: number }
  bhEr: { bhxh: number; om: number; tnld: number; bhyt: number; bhtn: number }
  selfDed: number
  depDed: number
  mealExempt: number
  brackets: PayBracket[]
}

type Citation = { code: string; policyId?: string; note?: string }

type PolicyVersion = {
  id: string
  version: number
  effective_from: string
  effective_to: string | null
  policy: PayParams
  citations: Citation[]
  legal_review_status: string
  legal_reviewed_by: string | null
  legal_reviewed_at: string | null
  bhxh_ceiling: number
  bhtn_ceiling: number
  matches_catalog: boolean
  is_current: boolean
}

type Catalog = {
  id: string
  label: string
  effectiveFrom: string
  params: PayParams
  citations: Citation[]
  legalLibraryNote: string
  bhxh_ceiling: number
  bhtn_ceiling: number
}

type FormState = {
  ref: string
  capMult: string
  bhtnRegionMin: string
  bhtnCapMult: string
  selfDed: string
  depDed: string
  mealExempt: string
  bhxhEmp: string
  bhytEmp: string
  bhtnEmp: string
  bhxhEr: string
  omEr: string
  tnldEr: string
  bhytEr: string
  bhtnEr: string
  brackets: { cap: string; ratePct: string }[]
}

function toForm(p: PayParams): FormState {
  return {
    ref: String(p.ref),
    capMult: String(p.capMult),
    bhtnRegionMin: String(p.bhtnRegionMin ?? p.ref),
    bhtnCapMult: String(p.bhtnCapMult ?? p.capMult),
    selfDed: String(p.selfDed),
    depDed: String(p.depDed),
    mealExempt: String(p.mealExempt),
    bhxhEmp: String(p.bhEmp.bhxh * 100),
    bhytEmp: String(p.bhEmp.bhyt * 100),
    bhtnEmp: String(p.bhEmp.bhtn * 100),
    bhxhEr: String(p.bhEr.bhxh * 100),
    omEr: String(p.bhEr.om * 100),
    tnldEr: String(p.bhEr.tnld * 100),
    bhytEr: String(p.bhEr.bhyt * 100),
    bhtnEr: String(p.bhEr.bhtn * 100),
    brackets: p.brackets.map(([cap, rate], i, arr) => ({
      cap: i === arr.length - 1 ? '' : String(cap),
      ratePct: String(rate * 100),
    })),
  }
}

function pctSum(...vals: string[]): number {
  return vals.reduce((s, v) => s + (Number(v) || 0), 0)
}

function legalTone(status: string) {
  if (status === 'approved') return 'good'
  if (status === 'rejected') return 'bad'
  return 'warn'
}

function parsePayload(form: FormState): PayParams | string {
  const num = (s: string, label: string) => {
    const n = Number(s)
    if (!Number.isFinite(n) || n < 0) throw new Error(`${label} không hợp lệ`)
    return n
  }
  try {
    const brackets: PayBracket[] = form.brackets.map((b, i) => {
      const rate = num(b.ratePct, `Thuế bậc ${i + 1}`) / 100
      if (i === form.brackets.length - 1) {
        return [1e15, rate]
      }
      return [num(b.cap, `Ngưỡng bậc ${i + 1}`), rate]
    })
    return {
      ref: num(form.ref, 'Lương cơ sở'),
      capMult: num(form.capMult, 'Hệ số trần BHXH'),
      bhtnRegionMin: num(form.bhtnRegionMin, 'LTT vùng'),
      bhtnCapMult: num(form.bhtnCapMult, 'Hệ số trần BHTN'),
      selfDed: num(form.selfDed, 'Giảm trừ bản thân'),
      depDed: num(form.depDed, 'Giảm trừ phụ thuộc'),
      mealExempt: num(form.mealExempt, 'Trần ăn ca'),
      bhEmp: {
        bhxh: num(form.bhxhEmp, 'BHXH NLĐ') / 100,
        bhyt: num(form.bhytEmp, 'BHYT NLĐ') / 100,
        bhtn: num(form.bhtnEmp, 'BHTN NLĐ') / 100,
      },
      bhEr: {
        bhxh: num(form.bhxhEr, 'BHXH DN') / 100,
        om: num(form.omEr, 'Ốm đau DN') / 100,
        tnld: num(form.tnldEr, 'TNLĐ DN') / 100,
        bhyt: num(form.bhytEr, 'BHYT DN') / 100,
        bhtn: num(form.bhtnEr, 'BHTN DN') / 100,
      },
      brackets,
    }
  } catch (e: unknown) {
    return e instanceof Error ? e.message : 'Tham số không hợp lệ'
  }
}

export function ParamsPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [versions, setVersions] = useState<PolicyVersion[]>([])
  const [current, setCurrent] = useState<PolicyVersion | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [drift, setDrift] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{
        items: PolicyVersion[]
        current: PolicyVersion | null
        driftFromCatalog: boolean
      }>('/api/payroll/policy-versions'),
      fetchJson<{ catalog: Catalog }>('/api/payroll/policy-catalog'),
    ])
      .then(([versionsRes, catalogRes]) => {
        setVersions(versionsRes.items ?? [])
        setCurrent(versionsRes.current)
        setDrift(!!versionsRes.driftFromCatalog)
        setCatalog(catalogRes.catalog)
        if (versionsRes.current) {
          setForm(toForm(versionsRes.current.policy))
        }
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

  const preview = useMemo(() => {
    if (!form) return null
    const parsed = parsePayload(form)
    if (typeof parsed === 'string') return null
    const bhxh = parsed.ref * parsed.capMult
    const region = parsed.bhtnRegionMin ?? parsed.ref
    const mult = parsed.bhtnCapMult ?? parsed.capMult
    const empPct =
      (parsed.bhEmp.bhxh + parsed.bhEmp.bhyt + parsed.bhEmp.bhtn) * 100
    const erPct =
      (parsed.bhEr.bhxh +
        parsed.bhEr.om +
        parsed.bhEr.tnld +
        parsed.bhEr.bhyt +
        parsed.bhEr.bhtn) *
      100
    return { bhxh, bhtn: region * mult, empPct, erPct }
  }, [form])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit || !current || !form) return
    const parsed = parsePayload(form)
    if (typeof parsed === 'string') {
      setMsg(parsed)
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetchJson<{ item: PolicyVersion }>(
        `/api/payroll/policy-versions/${current.id}`,
        { method: 'PATCH', body: JSON.stringify(parsed) },
      )
      setCurrent(res.item)
      setForm(toForm(res.item.policy))
      setDrift(!res.item.matches_catalog)
      setMsg('Đã lưu — trạng thái duyệt pháp lý chuyển về chờ duyệt.')
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  async function syncCatalog() {
    if (!canEdit || !current) return
    if (
      !window.confirm(
        `Đồng bộ số liệu từ catalog ${catalog?.id ?? 'VN_PAY_POLICY'} vào phiên bản đang hiệu lực? Trạng thái duyệt sẽ về chờ duyệt.`,
      )
    ) {
      return
    }
    setSyncing(true)
    setMsg(null)
    try {
      const res = await fetchJson<{ item: PolicyVersion; note?: string }>(
        `/api/payroll/policy-versions/${current.id}/sync-catalog`,
        { method: 'POST', body: '{}' },
      )
      setCurrent(res.item)
      setForm(toForm(res.item.policy))
      setDrift(false)
      setMsg(
        res.note ?? 'Đã đồng bộ từ thư viện pháp lý / catalog platform.',
      )
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không đồng bộ được')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="stack">
        <p className="page-lead muted">Đang tải tham số tính lương…</p>
      </div>
    )
  }

  if (error || !current || !form) {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{error ?? 'Chưa có phiên bản chính sách lương.'}</p>
      </div>
    )
  }

  const empTotal = pctSum(form.bhxhEmp, form.bhytEmp, form.bhtnEmp)
  const erTotal = pctSum(
    form.bhxhEr,
    form.omEr,
    form.tnldEr,
    form.bhytEr,
    form.bhtnEr,
  )

  return (
    <div className="stack">
      <p className="page-lead muted">
        Tham số BHXH / BHYT / BHTN, giảm trừ TNCN, trần ăn ca và biểu thuế — lấy
        từ phiên bản <code>{current.id}</code> (hiệu lực{' '}
        {current.effective_from}
        {current.effective_to ? ` → ${current.effective_to}` : ' → hiện hành'}).
        Số liệu chuẩn platform: <code>{catalog?.id}</code> · thư viện{' '}
        <Link to="/policies/legal">Pháp lý</Link>.
      </p>

      {drift ? (
        <div className="card policy-card">
          <h2>Có bản cập nhật pháp lý</h2>
          <p>
            Phiên bản đang hiệu lực khác catalog{' '}
            <b>{catalog?.label ?? catalog?.id}</b> (hiệu lực từ{' '}
            {catalog?.effectiveFrom}). Bấm đồng bộ để áp dụng số liệu mới nhất
            đã seed trong thư viện pháp lý — không crawl website nhà nước.
          </p>
          {canEdit ? (
            <button
              type="button"
              className="btn primary"
              disabled={syncing}
              onClick={() => void syncCatalog()}
            >
              {syncing ? 'Đang đồng bộ…' : 'Đồng bộ từ thư viện pháp lý'}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="card policy-card">
          <h2>Đã khớp catalog pháp lý</h2>
          <p>
            Tham số hiện tại trùng <b>{catalog?.label ?? catalog?.id}</b>. Khi
            luật đổi, platform phát hành catalog mới (mã + seed Pháp lý); trang
            này phát hiện lệch và cho phép đồng bộ một lần vào phiên bản đang
            hiệu lực.
          </p>
          {canEdit ? (
            <button
              type="button"
              className="btn ghost"
              disabled={syncing}
              onClick={() => void syncCatalog()}
            >
              {syncing ? 'Đang đồng bộ…' : 'Đồng bộ lại từ catalog'}
            </button>
          ) : null}
        </div>
      )}

      <div
        className="row"
        style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <span
          className={`status-pill ${legalTone(current.legal_review_status)}`}
        >
          {labelOf(LEGAL_REVIEW_STATUS, current.legal_review_status)}
        </span>
        <span className="muted small mono">
          v{current.version} · {current.id}
        </span>
        {preview ? (
          <>
            <span className="muted small">
              Trần BHXH/BHYT: <b>{vnd(preview.bhxh)}</b>
            </span>
            <span className="muted small">
              Trần BHTN: <b>{vnd(preview.bhtn)}</b>
            </span>
            <span className="muted small">
              NLĐ {dec(Math.round(preview.empPct * 10) / 10)}% · DN{' '}
              {dec(Math.round(preview.erPct * 10) / 10)}%
            </span>
          </>
        ) : null}
      </div>

      {msg ? <p className="warn-text">{msg}</p> : null}

      <form className="stack" onSubmit={(e) => void save(e)}>
        <div className="card">
          <h2>Mức tham chiếu & trần bảo hiểm</h2>
          <div className="form-grid">
            <label>
              Lương cơ sở / mức tham chiếu (₫)
              <input
                type="number"
                min={0}
                step={1000}
                value={form.ref}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, ref: e.target.value } : f))
                }
              />
              <span className="muted small">pol_h14 — NĐ 161/2026</span>
            </label>
            <label>
              Hệ số trần BHXH/BHYT
              <input
                type="number"
                min={1}
                step={1}
                value={form.capMult}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, capMult: e.target.value } : f))
                }
              />
              <span className="muted small">pol_h11 — thường = 20</span>
            </label>
            <label>
              Lương tối thiểu vùng (₫)
              <input
                type="number"
                min={0}
                step={1000}
                value={form.bhtnRegionMin}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, bhtnRegionMin: e.target.value } : f,
                  )
                }
              />
              <span className="muted small">
                pol_h15 — NĐ 293/2025 (demo vùng I)
              </span>
            </label>
            <label>
              Hệ số trần BHTN
              <input
                type="number"
                min={1}
                step={1}
                value={form.bhtnCapMult}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, bhtnCapMult: e.target.value } : f,
                  )
                }
              />
              <span className="muted small">pol_h18 — Luật Việc làm 2025</span>
            </label>
          </div>
          <div className="grid g2" style={{ marginTop: 12 }}>
            <div className="tile">
              <div className="v">{vnd(preview?.bhxh)}</div>
              <div className="muted small">
                Trần BHXH / BHYT (= ref × capMult)
              </div>
            </div>
            <div className="tile">
              <div className="v">{vnd(preview?.bhtn)}</div>
              <div className="muted small">
                Trần BHTN (= LTT vùng × hệ số) — tách riêng trần BHXH
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Tỷ lệ đóng bảo hiểm</h2>
          <div className="form-grid">
            <label>
              BHXH NLĐ (%)
              <input
                type="number"
                step={0.1}
                value={form.bhxhEmp}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, bhxhEmp: e.target.value } : f))
                }
              />
            </label>
            <label>
              BHYT NLĐ (%)
              <input
                type="number"
                step={0.1}
                value={form.bhytEmp}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, bhytEmp: e.target.value } : f))
                }
              />
            </label>
            <label>
              BHTN NLĐ (%)
              <input
                type="number"
                step={0.1}
                value={form.bhtnEmp}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, bhtnEmp: e.target.value } : f))
                }
              />
            </label>
            <label>
              Tổng NLĐ
              <input value={`${dec(empTotal)}%`} disabled readOnly />
            </label>
            <label>
              BHXH DN — hưu trí (%)
              <input
                type="number"
                step={0.1}
                value={form.bhxhEr}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, bhxhEr: e.target.value } : f))
                }
              />
            </label>
            <label>
              Ốm đau–thai sản DN (%)
              <input
                type="number"
                step={0.1}
                value={form.omEr}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, omEr: e.target.value } : f))
                }
              />
            </label>
            <label>
              TNLĐ–BNN DN (%)
              <input
                type="number"
                step={0.1}
                value={form.tnldEr}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, tnldEr: e.target.value } : f))
                }
              />
            </label>
            <label>
              BHYT DN (%)
              <input
                type="number"
                step={0.1}
                value={form.bhytEr}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, bhytEr: e.target.value } : f))
                }
              />
            </label>
            <label>
              BHTN DN (%)
              <input
                type="number"
                step={0.1}
                value={form.bhtnEr}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, bhtnEr: e.target.value } : f))
                }
              />
            </label>
            <label>
              Tổng DN
              <input value={`${dec(erTotal)}%`} disabled readOnly />
            </label>
          </div>
          <p className="muted small">
            Mẫu chuẩn: NLĐ 10,5% · DN 21,5% (pol_h11 + pol_h18 + pol_h19).
          </p>
        </div>

        <div className="card">
          <h2>Giảm trừ TNCN & miễn thuế ăn ca</h2>
          <div className="form-grid">
            <label>
              Giảm trừ bản thân (₫/tháng)
              <input
                type="number"
                min={0}
                step={100000}
                value={form.selfDed}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, selfDed: e.target.value } : f))
                }
              />
              <span className="muted small">pol_h12 — NQ 110/2025</span>
            </label>
            <label>
              Giảm trừ phụ thuộc (₫/tháng)
              <input
                type="number"
                min={0}
                step={100000}
                value={form.depDed}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, depDed: e.target.value } : f))
                }
              />
              <span className="muted small">pol_h12</span>
            </label>
            <label>
              Trần miễn thuế tiền ăn ca (₫)
              <input
                type="number"
                min={0}
                step={10000}
                value={form.mealExempt}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, mealExempt: e.target.value } : f,
                  )
                }
              />
              <span className="muted small">pol_h16 — NĐ 253/2026</span>
            </label>
          </div>
        </div>

        <div className="card table-card">
          <h2>Biểu thuế TNCN lũy tiến (tháng)</h2>
          <p className="muted small">
            pol_h17 — Luật 109/2025/QH15 · 5 bậc 5% / 10% / 20% / 30% / 35%. Bậc
            cuối là phần vượt ngưỡng trước đó (không nhập trần).
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Bậc</th>
                  <th>Thu nhập tính thuế đến (₫)</th>
                  <th>Thuế suất (%)</th>
                </tr>
              </thead>
              <tbody>
                {form.brackets.map((b, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      {i === form.brackets.length - 1 ? (
                        <span className="muted">Phần còn lại</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={1000000}
                          value={b.cap}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const cap = e.target.value
                            setForm((f) => {
                              if (!f) return f
                              const brackets = f.brackets.map((row, j) =>
                                j === i ? { ...row, cap } : row,
                              )
                              return { ...f, brackets }
                            })
                          }}
                        />
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={b.ratePct}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const ratePct = e.target.value
                          setForm((f) => {
                            if (!f) return f
                            const brackets = f.brackets.map((row, j) =>
                              j === i ? { ...row, ratePct } : row,
                            )
                            return { ...f, brackets }
                          })
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card policy-card">
          <h2>Công thức (tóm tắt)</h2>
          <ul className="plain-list">
            <li>
              Lương ngày công = lương CB × ngày công hưởng lương / ngày công
              chuẩn
            </li>
            <li>
              Gross = lương ngày công + phụ cấp + thưởng; exempt = min(ăn
              trưa, mealExempt)
            </li>
            <li>
              bhBase = min(lương CB, trần BHXH/BHYT); bhtnBase = min(lương CB,
              trần BHTN)
            </li>
            <li>
              Thu nhập tính thuế = max(0, gross − exempt − BH NLĐ − giảm trừ)
            </li>
            <li>PIT theo biểu lũy tiến; net = gross − BH NLĐ − PIT</li>
          </ul>
        </div>

        {canEdit ? (
          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu tham số'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!catalog}
              onClick={() => {
                if (!catalog) return
                setForm(toForm(catalog.params))
                setMsg('Đã nạp số liệu catalog vào form — bấm Lưu để ghi DB.')
              }}
            >
              Nạp catalog vào form
            </button>
          </div>
        ) : (
          <p className="muted small">
            Chỉ Admin / Super Admin được sửa hoặc đồng bộ tham số.
          </p>
        )}
      </form>

      <div className="card">
        <h2>Dẫn chiếu pháp lý</h2>
        {(current.citations?.length
          ? current.citations
          : (catalog?.citations ?? [])
        ).length === 0 ? (
          <p className="muted">Chưa có citation.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Thư viện</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {(current.citations?.length
                  ? current.citations
                  : (catalog?.citations ?? [])
                ).map((c) => (
                  <tr key={`${c.code}-${c.policyId ?? ''}`}>
                    <td className="mono">{c.code}</td>
                    <td>
                      {c.policyId ? (
                        <Link to="/policies/legal">{c.policyId}</Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="muted small">{c.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small" style={{ marginTop: 8 }}>
          {catalog?.legalLibraryNote}
        </p>
      </div>

      <div className="card table-card">
        <h2>Lịch sử phiên bản</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Hiệu lực</th>
                <th>Trần BHXH</th>
                <th>Trần BHTN</th>
                <th>Duyệt</th>
                <th>Catalog</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td className="mono">
                    {v.id}
                    {v.is_current ? ' · hiện hành' : ''}
                  </td>
                  <td className="mono">
                    {v.effective_from}
                    {v.effective_to ? ` → ${v.effective_to}` : ' →'}
                  </td>
                  <td className="mono">{vnd(v.bhxh_ceiling)}</td>
                  <td className="mono">{vnd(v.bhtn_ceiling)}</td>
                  <td>
                    <span
                      className={`status-pill ${legalTone(v.legal_review_status)}`}
                    >
                      {labelOf(LEGAL_REVIEW_STATUS, v.legal_review_status)}
                    </span>
                  </td>
                  <td>{v.matches_catalog ? 'Khớp' : 'Lệch'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
