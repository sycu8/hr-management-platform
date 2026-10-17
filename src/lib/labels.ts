/** Shared Vietnamese labels for status codes shown in tables. */

export const TRIP_STATUS: Record<string, string> = {
  draft: 'Nháp',
  pm: 'Chờ QL',
  ph: 'Chờ HR',
  ap: 'Đã duyệt',
  st: 'Quyết toán',
  ok: 'Hoàn tất',
  rj: 'Từ chối',
}

export const LEAVE_STATUS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Hủy',
}

export const PAYROLL_STATUS: Record<string, string> = {
  draft: 'Đang tạm tính',
  closed: 'Đã chốt',
}

export const LEGAL_REVIEW_STATUS: Record<string, string> = {
  pending: 'Chờ duyệt pháp lý',
  approved: 'Đã duyệt pháp lý',
  rejected: 'Từ chối pháp lý',
}

export const EARNING_KIND: Record<string, string> = {
  allowance: 'Phụ cấp',
  bonus: 'Thưởng',
}

export const CYCLE_STATUS: Record<string, string> = {
  planned: 'Sắp mở',
  open: 'Đang mở',
  closed: 'Đã đóng',
}

export function labelOf(
  map: Record<string, string>,
  code: string | null | undefined,
): string {
  if (!code) return '—'
  return map[code] ?? code
}
