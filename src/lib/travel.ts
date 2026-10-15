export {
  calcTravel,
  estimateTravel,
  settleTravel,
  type CalcTravelInput,
  type HotelMode,
  type MealMode,
  type TravelCalcResult,
  type TravelPolicy,
  type TravelZone,
} from '../../shared/domain/travel.ts'
export { formatVnd } from '../../shared/domain/money.ts'
export { GOLDEN_TRAVEL_POLICY } from '../../shared/fixtures/golden.ts'

export const ZONE_OPTIONS = [
  { value: 'dn1', label: 'Hà Nội, TP.HCM' },
  { value: 'dn2', label: 'Thành phố loại I/II khác' },
  { value: 'dn3', label: 'Tỉnh, địa phương còn lại' },
  { value: 'qt1', label: 'Quốc tế · Châu Á (USD)' },
  { value: 'qt2', label: 'Quốc tế · Âu, Mỹ, Úc (USD)' },
] as const
