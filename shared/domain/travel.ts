import { dateDiff } from './dates.ts'
import { capNonNeg, formatVnd, roundVnd } from './money.ts'

export type TravelZone = {
  name: string
  intl: boolean
  perDiem: readonly number[]
  hotel: readonly number[]
}

export type TravelPolicy = {
  zones: Record<string, TravelZone>
  fx: number
  fullHours: number
  halfHours: number
  minKm: number
  flatRatio: number
  localDom: number
  localIntl: number
  mealPartial: number
  mealFull: number
  settleDays: number
}

export type HotelMode = 'actual' | 'flat' | 'none'
export type MealMode = 'none' | 'partial' | 'full'

/** Inputs matching legacy `calc(p)`. */
export type CalcTravelInput = {
  zone: string
  level: number
  start: string
  end: string
  distance: number
  meal: MealMode | string
  hotelMode: HotelMode | string
  /** Estimate path: room rate per night. */
  hotelPerNight?: number
  /** Settlement path: total hotel invoice. */
  hotelTotal?: number | null
  transport: number
  other: number
}

export type TravelCalcResult = {
  days: number
  nights: number
  calDays: number
  hours: number
  rate: number
  perDiem: number
  hotelLimit: number
  hotel: number
  hotelExcess: number
  local: number
  transport: number
  other: number
  total: number
  notes: string[]
  zone: TravelZone
  mealPct: number
  valid: boolean
}

/**
 * Exact port of legacy `calc(p)` from `index.html`.
 * Policy is injected instead of reading global `S.policy`.
 */
export function calcTravel(p: CalcTravelInput, policy: TravelPolicy): TravelCalcResult {
  const P = policy
  const z = P.zones[p.zone] || P.zones.dn3
  const fx = z.intl ? P.fx : 1
  const lv = +p.level || 0
  const r: TravelCalcResult = {
    days: 0,
    nights: 0,
    calDays: 0,
    hours: 0,
    rate: 0,
    perDiem: 0,
    hotelLimit: 0,
    hotel: 0,
    hotelExcess: 0,
    local: 0,
    transport: +p.transport || 0,
    other: +p.other || 0,
    total: 0,
    notes: [],
    zone: z,
    mealPct: 0,
    valid: false,
  }
  if (!p.start || !p.end) return r
  const a = new Date(p.start)
  const b = new Date(p.end)
  r.hours = (b.getTime() - a.getTime()) / 36e5
  if (!(r.hours > 0)) {
    r.notes.push('Thời gian về phải sau thời gian đi.')
    return r
  }
  r.valid = true
  const full = Math.floor(r.hours / 24)
  const rem = r.hours - full * 24
  r.days = full + (rem >= P.fullHours ? 1 : rem >= P.halfHours ? 0.5 : 0)
  r.nights = capNonNeg(dateDiff(p.start, p.end))
  r.calDays = r.nights + 1
  r.rate = z.perDiem[lv] * fx
  r.mealPct =
    ({ none: 0, partial: P.mealPartial, full: P.mealFull } as Record<string, number>)[
      p.meal
    ] || 0
  if (!z.intl && (+p.distance || 0) < P.minKm) {
    r.perDiem = 0
    r.notes.push(
      'Địa điểm cách nơi làm việc dưới ' +
        P.minKm +
        ' km nên không được hưởng phụ cấp lưu trú.',
    )
  } else {
    r.perDiem = roundVnd(r.days * r.rate * (1 - r.mealPct))
  }
  r.hotelLimit = roundVnd(z.hotel[lv] * fx)
  const total =
    p.hotelTotal != null ? Number(p.hotelTotal) || 0 : Number(p.hotelPerNight ?? 0) * r.nights
  if (p.hotelMode === 'flat') {
    r.hotel = roundVnd(r.nights * r.hotelLimit * P.flatRatio)
  } else if (p.hotelMode === 'actual') {
    const cp = r.nights * r.hotelLimit
    r.hotel = Math.min(total, cp)
    r.hotelExcess = capNonNeg(total - cp)
    if (r.hotelExcess > 0) {
      r.notes.push(
        'Tiền phòng vượt định mức ' +
          formatVnd(r.hotelExcess) +
          ', phần vượt do cá nhân chịu.',
      )
    }
  } else {
    r.hotel = 0
  }
  if (r.nights === 0 && p.hotelMode !== 'none') {
    r.notes.push('Đi và về trong ngày nên không phát sinh tiền lưu trú.')
  }
  r.local = roundVnd(r.calDays * (z.intl ? P.localIntl : P.localDom))
  r.total = r.perDiem + r.hotel + r.local + r.transport + r.other
  return r
}

/** Legacy `estOf` mapping. */
export function estimateTravel(
  trip: {
    zone: string
    start: string
    end: string
    distance: number
    meal: string
    hotelMode: string
    hotelPrice: number
    transportEst: number
    otherEst: number
  },
  level: number,
  policy: TravelPolicy,
): TravelCalcResult {
  return calcTravel(
    {
      zone: trip.zone,
      level,
      start: trip.start,
      end: trip.end,
      distance: trip.distance,
      meal: trip.meal,
      hotelMode: trip.hotelMode,
      hotelPerNight: trip.hotelPrice,
      transport: trip.transportEst,
      other: trip.otherEst,
    },
    policy,
  )
}

/** Legacy `actOf` mapping. */
export function settleTravel(
  trip: {
    zone: string
    distance: number
    meal: string
    hotelMode: string
    actual: {
      start: string
      end: string
      hotel: number
      transport: number
      other: number
    } | null
  },
  level: number,
  policy: TravelPolicy,
): TravelCalcResult | null {
  if (!trip.actual) return null
  const a = trip.actual
  return calcTravel(
    {
      zone: trip.zone,
      level,
      start: a.start,
      end: a.end,
      distance: trip.distance,
      meal: trip.meal,
      hotelMode: trip.hotelMode,
      hotelTotal: a.hotel,
      transport: a.transport,
      other: a.other,
    },
    policy,
  )
}

/** Legacy settlement overdue: status `ap` and days since end > settleDays. */
export function isSettleOverdue(
  trip: { status: string; end: string },
  policy: TravelPolicy,
  today: Date,
): boolean {
  if (trip.status !== 'ap') return false
  return (today.getTime() - new Date(trip.end).getTime()) / 864e5 > policy.settleDays
}
