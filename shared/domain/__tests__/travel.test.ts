import { describe, expect, it } from 'vitest'
import {
  GOLDEN_TRAVEL,
  GOLDEN_TRAVEL_POLICY,
  GOLDEN_TRIP_CT_2026_0001,
} from '../../fixtures/golden.ts'
import { calcTravel, estimateTravel, settleTravel } from '../travel.ts'

describe('calcTravel — CT-2026-0001', () => {
  const trip = GOLDEN_TRIP_CT_2026_0001
  const policy = GOLDEN_TRAVEL_POLICY

  it('estimate total is 6.870.000 ₫', () => {
    const est = estimateTravel(trip, trip.level, policy)
    expect(est.valid).toBe(true)
    expect(est.days).toBe(GOLDEN_TRAVEL.estimate.days)
    expect(est.nights).toBe(GOLDEN_TRAVEL.estimate.nights)
    expect(est.perDiem).toBe(GOLDEN_TRAVEL.estimate.perDiem)
    expect(est.hotel).toBe(GOLDEN_TRAVEL.estimate.hotel)
    expect(est.local).toBe(GOLDEN_TRAVEL.estimate.local)
    expect(est.total).toBe(GOLDEN_TRAVEL.estimateTotal)
  })

  it('settlement total is 6.990.000 ₫', () => {
    const act = settleTravel(trip, trip.level, policy)
    expect(act).not.toBeNull()
    expect(act!.days).toBe(GOLDEN_TRAVEL.settlement.days)
    expect(act!.nights).toBe(GOLDEN_TRAVEL.settlement.nights)
    expect(act!.perDiem).toBe(GOLDEN_TRAVEL.settlement.perDiem)
    expect(act!.hotel).toBe(GOLDEN_TRAVEL.settlement.hotel)
    expect(act!.local).toBe(GOLDEN_TRAVEL.settlement.local)
    expect(act!.total).toBe(GOLDEN_TRAVEL.settlementTotal)
  })

  it('matches raw calcTravel paths', () => {
    const est = calcTravel(
      {
        zone: trip.zone,
        level: trip.level,
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
    const act = calcTravel(
      {
        zone: trip.zone,
        level: trip.level,
        start: trip.actual.start,
        end: trip.actual.end,
        distance: trip.distance,
        meal: trip.meal,
        hotelMode: trip.hotelMode,
        hotelTotal: trip.actual.hotel,
        transport: trip.actual.transport,
        other: trip.actual.other,
      },
      policy,
    )
    expect(est.total).toBe(6_870_000)
    expect(act.total).toBe(6_990_000)
  })
})
