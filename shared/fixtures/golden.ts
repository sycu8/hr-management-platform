import type { Holiday } from '../domain/dates.ts'
import type { PayParams } from '../domain/payroll.ts'
import type { TravelPolicy } from '../domain/travel.ts'

/** Fixed sample "today" from the legacy portal seed. */
export const GOLDEN_TODAY = new Date('2026-10-12T09:00')
export const GOLDEN_TODAY_STR = '2026-10-12'
export const GOLDEN_PAY_YM = '2026-09'

/** Legacy `defPolicy()`. */
export const GOLDEN_TRAVEL_POLICY: TravelPolicy = {
  zones: {
    dn1: {
      name: 'Hà Nội, TP.HCM',
      intl: false,
      perDiem: [200000, 250000, 300000, 400000],
      hotel: [800000, 1000000, 1500000, 2500000],
    },
    dn2: {
      name: 'Thành phố loại I/II khác',
      intl: false,
      perDiem: [180000, 220000, 270000, 350000],
      hotel: [600000, 800000, 1200000, 2000000],
    },
    dn3: {
      name: 'Tỉnh, địa phương còn lại',
      intl: false,
      perDiem: [150000, 200000, 250000, 300000],
      hotel: [500000, 650000, 1000000, 1500000],
    },
    qt1: {
      name: 'Quốc tế · Châu Á (USD)',
      intl: true,
      perDiem: [50, 60, 80, 100],
      hotel: [70, 90, 130, 200],
    },
    qt2: {
      name: 'Quốc tế · Âu, Mỹ, Úc (USD)',
      intl: true,
      perDiem: [70, 85, 110, 140],
      hotel: [100, 130, 180, 280],
    },
  },
  fx: 25500,
  fullHours: 12,
  halfHours: 4,
  minKm: 15,
  flatRatio: 0.6,
  localDom: 100000,
  localIntl: 300000,
  mealPartial: 0.3,
  mealFull: 0.7,
  settleDays: 7,
}

/**
 * Pay params for Sep 2026 golden cohort — policy effective 01/07/2026:
 * NĐ 161/2026 (lương cơ sở 2.53tr), NĐ 253/2026 (ăn ca miễn thuế 1.2tr),
 * NĐ 293/2025 (LTT vùng I 5.31tr → trần BHTN), Luật BHXH 2024 tỷ lệ đóng.
 */
export const GOLDEN_PAY: PayParams = {
  ref: 2_530_000,
  capMult: 20,
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

/** CT-2026-0001 — Nguyễn Minh Anh, Đà Nẵng. */
export const GOLDEN_TRIP_CT_2026_0001 = {
  id: 't1',
  code: 'CT-2026-0001',
  empId: 'e1',
  level: 1,
  dest: 'Đà Nẵng',
  zone: 'dn2',
  start: '2026-09-14T07:30',
  end: '2026-09-17T19:00',
  distance: 770,
  transport: 'Máy bay',
  transportEst: 3200000,
  otherEst: 400000,
  hotelMode: 'actual' as const,
  hotelPrice: 700000,
  meal: 'none' as const,
  advance: 6000000,
  status: 'ok',
  actual: {
    start: '2026-09-14T07:30',
    end: '2026-09-17T18:00',
    hotel: 2250000,
    transport: 3050000,
    other: 520000,
    receipts: 6,
    note: 'Giá phòng thực tế thấp hơn dự toán.',
  },
}

export const GOLDEN_TRAVEL = {
  code: 'CT-2026-0001',
  estimateTotal: 6870000,
  settlementTotal: 6990000,
  estimate: {
    days: 3.5,
    nights: 3,
    perDiem: 770000,
    hotel: 2100000,
    local: 400000,
    total: 6870000,
  },
  settlement: {
    days: 3.5,
    nights: 3,
    perDiem: 770000,
    hotel: 2250000,
    local: 400000,
    total: 6990000,
  },
} as const

export const GOLDEN_PIT = [
  { taxable: 10_000_000, tax: 500_000 },
  { taxable: 25_000_000, tax: 2_000_000 },
  { taxable: 70_000_000, tax: 11_500_000 },
] as const

export const GOLDEN_PAYROLL_SEP = {
  ym: '2026-09',
  stdDays: 22,
  employees: {
    e1: { paid: 22, gross: 24730000, bhEmp: 1890000, pit: 20500, net: 22819500 },
    e4: { paid: 21, gross: 64184545, bhEmp: 4725000, pit: 2665909, net: 56793636 },
    /** e5 over BHXH ceiling — uses 50.6tr BHXH/BHYT + 85tr BHTN (vùng I). */
    e5: { paid: 22, gross: 86530000, bhEmp: 5657000, pit: 6948600, net: 73924400 },
    e11: { paid: 22, gross: 12730000, bhEmp: 0, pit: 0, net: 12730000 },
  },
  company: {
    gross: 375420909,
    pit: 11829509,
    net: 333259400,
  },
} as const

export const GOLDEN_HOLIDAYS: Holiday[] = [
  ['2026-01-01', 'Tết Dương lịch'],
  ['2026-02-14', 'Tết Nguyên đán'],
  ['2026-02-15', 'Tết Nguyên đán'],
  ['2026-02-16', 'Tết Nguyên đán'],
  ['2026-02-17', 'Mùng 1 Tết'],
  ['2026-02-18', 'Tết Nguyên đán'],
  ['2026-02-19', 'Tết Nguyên đán'],
  ['2026-02-20', 'Tết Nguyên đán'],
  ['2026-02-21', 'Tết Nguyên đán'],
  ['2026-02-22', 'Tết Nguyên đán'],
  ['2026-04-27', 'Nghỉ bù Giỗ Tổ Hùng Vương'],
  ['2026-04-30', 'Ngày Giải phóng miền Nam'],
  ['2026-05-01', 'Quốc tế Lao động'],
  ['2026-09-02', 'Quốc khánh'],
]

export type GoldenEmployee = {
  id: string
  code: string
  name: string
  dept: string
  level: number
  joined: string
  leftDate: string
  base: number
  dependents: number
  status: string
  contract: { type: string; start: string; end: string }
}

/** Full employee seed needed for Sep 2026 company payroll totals. */
export const GOLDEN_EMPLOYEES: GoldenEmployee[] = [
  {
    id: 'e1',
    code: 'NV001',
    name: 'Nguyễn Minh Anh',
    dept: 'Kinh doanh',
    level: 1,
    joined: '2022-03-01',
    leftDate: '',
    base: 18000000,
    dependents: 1,
    status: 'active',
    contract: { type: 'Không xác định thời hạn', start: '2025-03-01', end: '' },
  },
  {
    id: 'e2',
    code: 'NV002',
    name: 'Trần Quốc Bảo',
    dept: 'Kỹ thuật',
    level: 0,
    joined: '2023-06-15',
    leftDate: '',
    base: 14000000,
    dependents: 0,
    status: 'active',
    contract: { type: 'Không xác định thời hạn', start: '2026-06-15', end: '' },
  },
  {
    id: 'e3',
    code: 'NV003',
    name: 'Lê Thu Hà',
    dept: 'Nhân sự',
    level: 2,
    joined: '2019-09-01',
    leftDate: '',
    base: 38000000,
    dependents: 2,
    status: 'active',
    contract: { type: 'Không xác định thời hạn', start: '2022-09-01', end: '' },
  },
  {
    id: 'e4',
    code: 'NV004',
    name: 'Phạm Đức Long',
    dept: 'Kinh doanh',
    level: 2,
    joined: '2018-02-12',
    leftDate: '',
    base: 45000000,
    dependents: 2,
    status: 'active',
    contract: { type: 'Không xác định thời hạn', start: '2021-02-12', end: '' },
  },
  {
    id: 'e5',
    code: 'NV005',
    name: 'Võ Thanh Tùng',
    dept: 'Ban giám đốc',
    level: 3,
    joined: '2016-01-04',
    leftDate: '',
    base: 85000000,
    dependents: 2,
    status: 'active',
    contract: { type: 'Không xác định thời hạn', start: '2019-01-04', end: '' },
  },
  {
    id: 'e6',
    code: 'NV006',
    name: 'Đặng Ngọc Mai',
    dept: 'Marketing',
    level: 1,
    joined: '2022-11-07',
    leftDate: '',
    base: 17000000,
    dependents: 0,
    status: 'active',
    contract: { type: 'Không xác định thời hạn', start: '2025-11-07', end: '' },
  },
  {
    id: 'e7',
    code: 'NV007',
    name: 'Bùi Gia Huy',
    dept: 'Kỹ thuật',
    level: 1,
    joined: '2020-08-17',
    leftDate: '',
    base: 28000000,
    dependents: 1,
    status: 'active',
    contract: { type: 'Không xác định thời hạn', start: '2023-08-17', end: '' },
  },
  {
    id: 'e8',
    code: 'NV008',
    name: 'Hoàng Phương Linh',
    dept: 'Kế toán',
    level: 1,
    joined: '2021-05-10',
    leftDate: '',
    base: 22000000,
    dependents: 0,
    status: 'active',
    contract: {
      type: 'Xác định thời hạn 24 tháng',
      start: '2025-01-01',
      end: '2026-12-31',
    },
  },
  {
    id: 'e9',
    code: 'NV009',
    name: 'Ngô Thị Thảo',
    dept: 'Nhân sự',
    level: 0,
    joined: '2024-02-01',
    leftDate: '',
    base: 13000000,
    dependents: 0,
    status: 'active',
    contract: {
      type: 'Xác định thời hạn 36 tháng',
      start: '2026-02-01',
      end: '2029-01-31',
    },
  },
  {
    id: 'e10',
    code: 'NV010',
    name: 'Đỗ Anh Khoa',
    dept: 'Marketing',
    level: 2,
    joined: '2019-04-08',
    leftDate: '',
    base: 40000000,
    dependents: 1,
    status: 'active',
    contract: { type: 'Không xác định thời hạn', start: '2022-04-08', end: '' },
  },
  {
    id: 'e11',
    code: 'NV011',
    name: 'Lý Hải Nam',
    dept: 'Kỹ thuật',
    level: 0,
    joined: '2026-08-03',
    leftDate: '',
    base: 12000000,
    dependents: 0,
    status: 'active',
    contract: { type: 'Thử việc', start: '2026-08-03', end: '2026-10-31' },
  },
  {
    id: 'e12',
    code: 'NV012',
    name: 'Trịnh Mỹ Duyên',
    dept: 'Kế toán',
    level: 0,
    joined: '2023-01-09',
    leftDate: '2026-08-15',
    base: 11000000,
    dependents: 0,
    status: 'left',
    contract: {
      type: 'Xác định thời hạn 24 tháng',
      start: '2025-01-09',
      end: '2027-01-08',
    },
  },
]

export const GOLDEN_LEAVES = [
  {
    id: 'l1',
    empId: 'e1',
    type: 'annual',
    from: '2026-03-09',
    to: '2026-03-11',
    days: 3,
    status: 'approved',
  },
  {
    id: 'l8',
    empId: 'e9',
    type: 'special',
    from: '2026-09-14',
    to: '2026-09-16',
    days: 3,
    status: 'approved',
  },
  {
    id: 'l9',
    empId: 'e10',
    type: 'unpaid',
    from: '2026-10-12',
    to: '2026-10-12',
    days: 1,
    status: 'approved',
  },
]

/** Trips that affect Sep 2026 attendance (approved/settled). */
export const GOLDEN_TRIPS = [
  {
    empId: 'e1',
    status: 'ok',
    start: '2026-09-14T07:30',
    end: '2026-09-17T19:00',
  },
  {
    empId: 'e2',
    status: 'ap',
    start: '2026-09-23T06:00',
    end: '2026-09-26T21:00',
  },
]

export const GOLDEN_CHECKINS: Record<string, { in: string; out: string }> = {
  '2026-10-12|e1': { in: '08:04', out: '' },
  '2026-10-12|e3': { in: '07:52', out: '' },
  '2026-10-12|e5': { in: '08:20', out: '' },
  '2026-10-12|e6': { in: '08:36', out: '' },
  '2026-10-12|e7': { in: '08:01', out: '' },
  '2026-10-12|e8': { in: '07:58', out: '' },
  '2026-10-12|e9': { in: '08:09', out: '' },
  '2026-10-12|e11': { in: '08:12', out: '' },
}

export const GOLDEN_ALLOW = [
  {
    id: 'a1',
    empId: 'all',
    ym: '*',
    type: 'Ăn trưa',
    kind: 'allowance',
    amount: 730000,
  },
  {
    id: 'a2',
    empId: 'e4',
    ym: '*',
    type: 'Điện thoại',
    kind: 'allowance',
    amount: 500000,
  },
  {
    id: 'a3',
    empId: 'e5',
    ym: '*',
    type: 'Điện thoại',
    kind: 'allowance',
    amount: 800000,
  },
  {
    id: 'a4',
    empId: 'e10',
    ym: '*',
    type: 'Điện thoại',
    kind: 'allowance',
    amount: 500000,
  },
  {
    id: 'a5',
    empId: 'e3',
    ym: '*',
    type: 'Trách nhiệm',
    kind: 'allowance',
    amount: 2000000,
  },
  {
    id: 'a6',
    empId: 'e7',
    ym: '*',
    type: 'Trách nhiệm',
    kind: 'allowance',
    amount: 2000000,
  },
  {
    id: 'a7',
    empId: 'e10',
    ym: '*',
    type: 'Trách nhiệm',
    kind: 'allowance',
    amount: 3000000,
  },
  {
    id: 'a8',
    empId: 'e4',
    ym: '*',
    type: 'Trách nhiệm',
    kind: 'allowance',
    amount: 5000000,
  },
  {
    id: 'a9',
    empId: 'e1',
    ym: '2026-09',
    type: 'Thưởng KPI quý 3',
    kind: 'bonus',
    amount: 6000000,
  },
  {
    id: 'a10',
    empId: 'e2',
    ym: '2026-09',
    type: 'Thưởng dự án',
    kind: 'bonus',
    amount: 3000000,
  },
  {
    id: 'a11',
    empId: 'e7',
    ym: '2026-09',
    type: 'Thưởng dự án',
    kind: 'bonus',
    amount: 4000000,
  },
  {
    id: 'a12',
    empId: 'e4',
    ym: '2026-09',
    type: 'Thưởng KPI quý 3',
    kind: 'bonus',
    amount: 15000000,
  },
]
