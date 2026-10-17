import { describe, expect, it } from 'vitest'
import {
  GOLDEN_ALLOW,
  GOLDEN_CHECKINS,
  GOLDEN_EMPLOYEES,
  GOLDEN_HOLIDAYS,
  GOLDEN_LEAVES,
  GOLDEN_PAY,
  GOLDEN_PAYROLL_SEP,
  GOLDEN_PIT,
  GOLDEN_TODAY_STR,
  GOLDEN_TRIPS,
} from '../../fixtures/golden.ts'
import { attMonth } from '../attendance.ts'
import {
  bhxhCeiling,
  bhtnCeiling,
  calcPay,
  payEmployees,
  pit,
  VN_PAY_POLICY_2026_07,
  payParamsMatchCatalog,
  VN_PAY_POLICY_CATALOG,
} from '../payroll.ts'

function attCtx() {
  return {
    todayStr: GOLDEN_TODAY_STR,
    holidays: GOLDEN_HOLIDAYS,
    leaves: GOLDEN_LEAVES,
    trips: GOLDEN_TRIPS,
    checkins: GOLDEN_CHECKINS,
    employees: GOLDEN_EMPLOYEES,
  }
}

function payFor(empId: string, ym = GOLDEN_PAYROLL_SEP.ym) {
  const e = GOLDEN_EMPLOYEES.find((x) => x.id === empId)!
  const at = attMonth(empId, ym, attCtx())
  return calcPay(e, ym, GOLDEN_PAY, at, GOLDEN_ALLOW)
}

describe('pit — progressive brackets', () => {
  for (const row of GOLDEN_PIT) {
    it(`${row.taxable} → ${row.tax}`, () => {
      expect(pit(row.taxable, GOLDEN_PAY.brackets)).toBe(row.tax)
    })
  }
})

describe('VN pay policy ceilings (01/07/2026)', () => {
  it('BHXH/BHYT ceiling = 20 × 2.530.000', () => {
    expect(bhxhCeiling(VN_PAY_POLICY_2026_07)).toBe(50_600_000)
    expect(GOLDEN_PAY.ref).toBe(2_530_000)
    expect(GOLDEN_PAY.mealExempt).toBe(1_200_000)
  })

  it('BHTN ceiling = 20 × LTT vùng I 5.310.000', () => {
    expect(bhtnCeiling(VN_PAY_POLICY_2026_07)).toBe(106_200_000)
  })

  it('catalog matches VN_PAY_POLICY_2026_07 fingerprint', () => {
    expect(VN_PAY_POLICY_CATALOG.id).toBe('VN_PAY_POLICY_2026_07')
    expect(payParamsMatchCatalog(VN_PAY_POLICY_CATALOG.params)).toBe(true)
    expect(
      payParamsMatchCatalog({
        ...VN_PAY_POLICY_2026_07,
        mealExempt: 730_000,
      }),
    ).toBe(false)
  })
})

describe('calcPay — Sep 2026 golden employees', () => {
  it('e1 net 22.819.500', () => {
    const c = payFor('e1')
    const g = GOLDEN_PAYROLL_SEP.employees.e1
    expect(c.at.std).toBe(GOLDEN_PAYROLL_SEP.stdDays)
    expect(c.at.paid).toBe(g.paid)
    expect(c.gross).toBe(g.gross)
    expect(c.bhEmp).toBe(g.bhEmp)
    expect(c.pit).toBe(g.pit)
    expect(c.net).toBe(g.net)
  })

  it('e4 net 56.793.636', () => {
    const c = payFor('e4')
    const g = GOLDEN_PAYROLL_SEP.employees.e4
    expect(c.at.paid).toBe(g.paid)
    expect(c.gross).toBe(g.gross)
    expect(c.bhEmp).toBe(g.bhEmp)
    expect(c.pit).toBe(g.pit)
    expect(c.net).toBe(g.net)
  })

  it('e5 over BHXH ceiling — net 73.924.400', () => {
    const c = payFor('e5')
    const g = GOLDEN_PAYROLL_SEP.employees.e5
    expect(c.at.paid).toBe(g.paid)
    expect(c.bhBase).toBe(50_600_000)
    expect(c.bhtnBase).toBe(85_000_000)
    expect(c.gross).toBe(g.gross)
    expect(c.bhEmp).toBe(g.bhEmp)
    expect(c.pit).toBe(g.pit)
    expect(c.net).toBe(g.net)
  })

  it('e11 probation net 12.730.000 (no BH / PIT)', () => {
    const c = payFor('e11')
    const g = GOLDEN_PAYROLL_SEP.employees.e11
    expect(c.prob).toBe(true)
    expect(c.at.paid).toBe(g.paid)
    expect(c.gross).toBe(g.gross)
    expect(c.bhEmp).toBe(0)
    expect(c.pit).toBe(0)
    expect(c.net).toBe(g.net)
  })
})

describe('calcPay — company Sep 2026 totals', () => {
  it('gross / PIT / net match ARCHITECTURE golden table', () => {
    const ym = GOLDEN_PAYROLL_SEP.ym
    const emps = payEmployees(GOLDEN_EMPLOYEES, ym)
    let gross = 0
    let pitSum = 0
    let net = 0
    for (const e of emps) {
      const at = attMonth(e.id, ym, attCtx())
      const c = calcPay(e, ym, GOLDEN_PAY, at, GOLDEN_ALLOW)
      gross += c.gross
      pitSum += c.pit
      net += c.net
    }
    expect(gross).toBe(GOLDEN_PAYROLL_SEP.company.gross)
    expect(pitSum).toBe(GOLDEN_PAYROLL_SEP.company.pit)
    expect(net).toBe(GOLDEN_PAYROLL_SEP.company.net)
  })
})
