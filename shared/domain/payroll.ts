import { roundVnd } from './money.ts'
import type { AttMonth } from './attendance.ts'

export type PayBracket = readonly [cap: number, rate: number]

export type PayParams = {
  ref: number
  capMult: number
  bhEmp: { bhxh: number; bhyt: number; bhtn: number }
  bhEr: { bhxh: number; om: number; tnld: number; bhyt: number; bhtn: number }
  selfDed: number
  depDed: number
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
  const salaryDays = roundVnd(base * at.paid / at.std)
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
  const bhBase = Math.min(base, P.ref * P.capMult)
  const be = prob
    ? { bhxh: 0, bhyt: 0, bhtn: 0 }
    : {
        bhxh: roundVnd(bhBase * P.bhEmp.bhxh),
        bhyt: roundVnd(bhBase * P.bhEmp.bhyt),
        bhtn: roundVnd(bhBase * P.bhEmp.bhtn),
      }
  const bhEmp = be.bhxh + be.bhyt + be.bhtn
  const er = prob
    ? { bhxh: 0, om: 0, tnld: 0, bhyt: 0, bhtn: 0 }
    : {
        bhxh: roundVnd(bhBase * P.bhEr.bhxh),
        om: roundVnd(bhBase * P.bhEr.om),
        tnld: roundVnd(bhBase * P.bhEr.tnld),
        bhyt: roundVnd(bhBase * P.bhEr.bhyt),
        bhtn: roundVnd(bhBase * P.bhEr.bhtn),
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
