import { roundVnd } from './money.ts'
import type { AttMonth } from './attendance.ts'

export type PayBracket = readonly [cap: number, rate: number]

export type PayParams = {
  /** Mức lương cơ sở / mức tham chiếu (BHXH–BHYT ceiling base). */
  ref: number
  /** Hệ số trần BHXH/BHYT (= 20 × mức tham chiếu). */
  capMult: number
  /**
   * Lương tối thiểu vùng — trần BHTN = bhtnRegionMin × bhtnCapMult.
   * Mặc định dùng `ref` nếu không khai báo (an toàn hơn / thấp hơn thực tế vùng I–IV).
   */
  bhtnRegionMin?: number
  /** Hệ số trần BHTN (mặc định = capMult = 20). */
  bhtnCapMult?: number
  bhEmp: { bhxh: number; bhyt: number; bhtn: number }
  bhEr: { bhxh: number; om: number; tnld: number; bhyt: number; bhtn: number }
  selfDed: number
  depDed: number
  /** Trần miễn thuế TNCN tiền ăn giữa ca / ăn trưa (chi bằng tiền). */
  mealExempt: number
  brackets: readonly PayBracket[]
}

export type AllowanceEntry = {
  empId: string
  ym: string
  type: string
  kind: 'allowance' | 'bonus' | string
  amount: number
}

export type CalcPayEmployee = {
  id: string
  base: number
  dependents: number
  contract: { type: string }
}

export type CalcPayResult = {
  at: AttMonth
  base: number
  salaryDays: number
  ents: AllowanceEntry[]
  allow: number
  bonus: number
  exempt: number
  gross: number
  prob: boolean
  bhBase: number
  bhtnBase: number
  be: { bhxh: number; bhyt: number; bhtn: number }
  bhEmp: number
  er: { bhxh: number; om: number; tnld: number; bhyt: number; bhtn: number }
  bhEr: number
  ded: number
  taxable: number
  pit: number
  net: number
  cost: number
  trip: number
}

/** Trần đóng BHXH / BHYT (= 20 × mức tham chiếu). */
export function bhxhCeiling(pay: PayParams): number {
  return pay.ref * pay.capMult
}

/** Trần đóng BHTN (= 20 × lương tối thiểu vùng). */
export function bhtnCeiling(pay: PayParams): number {
  const region = pay.bhtnRegionMin ?? pay.ref
  const mult = pay.bhtnCapMult ?? pay.capMult
  return region * mult
}

/**
 * Progressive PIT (legacy `H.pit`).
 * Brackets are cumulative caps with marginal rates, e.g.
 * `[[10e6,0.05],[30e6,0.10],...]`.
 */
export function pit(x: number, brackets: readonly PayBracket[]): number {
  let tax = 0
  let low = 0
  for (const [cap, r] of brackets) {
    if (x > low) tax += (Math.min(x, cap) - low) * r
    low = cap
    if (x <= cap) break
  }
  return roundVnd(tax)
}

/**
 * Exact legacy `H.calcPay` formulas as a pure function.
 * Attendance month and trip note total are injected (no global state).
 *
 * BHXH/BHYT base capped at 20× mức tham chiếu (Luật BHXH 2024 + NĐ 161/2026);
 * BHTN base capped at 20× lương tối thiểu vùng (Luật Việc làm 2025 + NĐ 293/2025).
 */
export function calcPay(
  e: CalcPayEmployee,
  ym: string,
  pay: PayParams,
  at: AttMonth,
  allowList: readonly AllowanceEntry[],
  tripTotal = 0,
): CalcPayResult {
  const P = pay
  const base = e.base
  const salaryDays = roundVnd((base * at.paid) / at.std)
  const ents = allowList.filter(
    (a) =>
      (a.empId === e.id || (a.empId === 'all' && at.paid > 0)) &&
      (a.ym === '*' || a.ym === ym),
  )
  const allow = ents
    .filter((a) => a.kind === 'allowance')
    .reduce((s, a) => s + a.amount, 0)
  const bonus = ents.filter((a) => a.kind === 'bonus').reduce((s, a) => s + a.amount, 0)
  const exempt = ents
    .filter((a) => a.type === 'Ăn trưa')
    .reduce((s, a) => s + Math.min(a.amount, P.mealExempt), 0)
  const gross = salaryDays + allow + bonus
  const prob = e.contract.type === 'Thử việc'
  const bhBase = Math.min(base, bhxhCeiling(P))
  const bhtnBase = Math.min(base, bhtnCeiling(P))
  const be = prob
    ? { bhxh: 0, bhyt: 0, bhtn: 0 }
    : {
        bhxh: roundVnd(bhBase * P.bhEmp.bhxh),
        bhyt: roundVnd(bhBase * P.bhEmp.bhyt),
        bhtn: roundVnd(bhtnBase * P.bhEmp.bhtn),
      }
  const bhEmp = be.bhxh + be.bhyt + be.bhtn
  const er = prob
    ? { bhxh: 0, om: 0, tnld: 0, bhyt: 0, bhtn: 0 }
    : {
        bhxh: roundVnd(bhBase * P.bhEr.bhxh),
        om: roundVnd(bhBase * P.bhEr.om),
        tnld: roundVnd(bhBase * P.bhEr.tnld),
        bhyt: roundVnd(bhBase * P.bhEr.bhyt),
        bhtn: roundVnd(bhtnBase * P.bhEr.bhtn),
      }
  const bhEr = er.bhxh + er.om + er.tnld + er.bhyt + er.bhtn
  const ded = P.selfDed + e.dependents * P.depDed
  const taxable = Math.max(0, gross - exempt - bhEmp - ded)
  const pitAmt = pit(taxable, P.brackets)
  const net = gross - bhEmp - pitAmt
  return {
    at,
    base,
    salaryDays,
    ents: [...ents],
    allow,
    bonus,
    exempt,
    gross,
    prob,
    bhBase,
    bhtnBase,
    be,
    bhEmp,
    er,
    bhEr,
    ded,
    taxable,
    pit: pitAmt,
    net,
    cost: gross + bhEr,
    trip: tripTotal,
  }
}

/** Employees in a pay month (legacy `H.payEmps`). */
export function payEmployees<T extends { joined: string; leftDate?: string }>(
  employees: readonly T[],
  ym: string,
): T[] {
  return employees.filter(
    (e) => e.joined <= ym + '-31' && (!e.leftDate || e.leftDate >= ym + '-01'),
  )
}

/**
 * Policy snapshot in force from 01/07/2026.
 * Citations: NĐ 161/2026, 253/2026, 293/2025; Luật BHXH 2024, Việc làm 2025,
 * TNCN 109/2025, NQ 110/2025 — see docs/LEGAL_PARAMETERS.md + seed pol_h11–pol_h20.
 */
export const VN_PAY_POLICY_2026_07: PayParams = {
  ref: 2_530_000,
  capMult: 20,
  /** Vùng I — Hà Nội / TP.HCM (NĐ 293/2025/NĐ-CP). */
  bhtnRegionMin: 5_310_000,
  bhtnCapMult: 20,
  bhEmp: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 },
  bhEr: { bhxh: 0.14, om: 0.03, tnld: 0.005, bhyt: 0.03, bhtn: 0.01 },
  selfDed: 15_500_000,
  depDed: 6_200_000,
  mealExempt: 1_200_000,
  brackets: [
    [10_000_000, 0.05],
    [30_000_000, 0.1],
    [60_000_000, 0.2],
    [100_000_000, 0.3],
    [1e15, 0.35],
  ],
}

/** Catalog id — bump when shipping a new statutory snapshot (e.g. next NĐ). */
export const VN_PAY_POLICY_CATALOG_ID = 'VN_PAY_POLICY_2026_07' as const

export type PayPolicyCitation = {
  code: string
  policyId: string
  note: string
}

/**
 * Source citations for the shipped catalog — map to `policy_documents` Pháp lý rows.
 * Sync action writes these into `payroll_policy_versions.source_citations_json`.
 */
export const VN_PAY_POLICY_CITATIONS: readonly PayPolicyCitation[] = [
  {
    code: '161/2026/NĐ-CP',
    policyId: 'pol_h14',
    note: 'Lương cơ sở 2.530.000₫ từ 01/07/2026 → trần BHXH/BHYT 50.600.000₫',
  },
  {
    code: '293/2025/NĐ-CP',
    policyId: 'pol_h15',
    note: 'LTT vùng I 5.310.000₫ → trần BHTN 106.200.000₫',
  },
  {
    code: '253/2026/NĐ-CP',
    policyId: 'pol_h16',
    note: 'Ăn ca chi tiền miễn thuế TNCN đến 1.200.000₫/tháng từ 01/07/2026',
  },
  {
    code: '109/2025/QH15',
    policyId: 'pol_h17',
    note: 'Luật Thuế TNCN — biểu 5 bậc 5/10/20/30/35%',
  },
  {
    code: '110/2025/NQ-UBTVQH',
    policyId: 'pol_h12',
    note: 'Giảm trừ bản thân 15,5tr / phụ thuộc 6,2tr',
  },
  {
    code: '41/2024/QH15',
    policyId: 'pol_h11',
    note: 'Luật BHXH 2024 — tỷ lệ NLĐ 8% + DN 14%+3%+0,5%; trần 20× lương cơ sở',
  },
  {
    code: '74/2025/QH15',
    policyId: 'pol_h18',
    note: 'Luật Việc làm 2025 — BHTN 1%+1%; trần 20× LTT vùng',
  },
  {
    code: '188/2025/NĐ-CP',
    policyId: 'pol_h19',
    note: 'BHYT 4,5% (NLĐ 1,5% / DN 3%)',
  },
]

/** Canonical catalog entry used by API sync (not live government scraping). */
export const VN_PAY_POLICY_CATALOG = {
  id: VN_PAY_POLICY_CATALOG_ID,
  label: 'Chính sách lương VN từ 01/07/2026',
  effectiveFrom: '2026-07-01',
  params: VN_PAY_POLICY_2026_07,
  citations: VN_PAY_POLICY_CITATIONS,
  legalLibraryNote:
    'Số liệu lấy từ hằng số platform + thư viện Pháp lý (pol_h11–pol_h20). Cập nhật khi phát hành phiên bản catalog mới trong mã nguồn / seed — không crawl site nhà nước.',
} as const

/** Stable JSON compare for drift detection vs catalog. */
export function payParamsFingerprint(p: PayParams): string {
  return JSON.stringify({
    ref: p.ref,
    capMult: p.capMult,
    bhtnRegionMin: p.bhtnRegionMin ?? null,
    bhtnCapMult: p.bhtnCapMult ?? null,
    bhEmp: p.bhEmp,
    bhEr: p.bhEr,
    selfDed: p.selfDed,
    depDed: p.depDed,
    mealExempt: p.mealExempt,
    brackets: p.brackets,
  })
}

export function payParamsMatchCatalog(p: PayParams): boolean {
  return payParamsFingerprint(p) === payParamsFingerprint(VN_PAY_POLICY_2026_07)
}
