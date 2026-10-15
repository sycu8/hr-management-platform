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

export function labelOf(
  map: Record<string, string>,
  code: string | null | undefined,
): string {
  if (!code) return '—'
  return map[code] ?? code
}
