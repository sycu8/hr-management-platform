/** Shared L&D helpers for enrollment / certificate status labels. */

export function enrollmentStatus(
  progress: number,
  dueOn: string | null | undefined,
  today = new Date().toISOString().slice(0, 10),
): { label: string; tone: 'good' | 'info' | 'warn' | 'bad' | '' } {
  const pct = progress <= 1 ? Math.round(progress * 100) : Math.round(progress)
  if (pct >= 100) return { label: 'Hoàn thành', tone: 'good' }
  if (dueOn && dueOn < today) return { label: 'Trễ hạn', tone: 'bad' }
  if (pct > 0) return { label: 'Đang học', tone: 'info' }
  return { label: 'Chưa học', tone: 'warn' }
}

export function progressPercent(progress: number): number {
  const p = progress ?? 0
  return p <= 1 ? Math.round(p * 100) : Math.round(p)
}

export function certValidity(
  expiresOn: string | null | undefined,
  today = new Date().toISOString().slice(0, 10),
): { label: string; tone: 'good' | 'info' | 'warn' | 'bad' | '' } {
  if (!expiresOn) return { label: 'Không thời hạn', tone: 'good' }
  if (expiresOn < today) return { label: 'Đã hết hạn', tone: 'bad' }
  const days = Math.ceil(
    (new Date(`${expiresOn}T12:00:00Z`).getTime() -
      new Date(`${today}T12:00:00Z`).getTime()) /
      86_400_000,
  )
  if (days <= 60) return { label: `Còn ${days} ngày`, tone: 'warn' }
  return { label: 'Còn hiệu lực', tone: 'good' }
}

export function courseStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'draft':
      return 'Nháp'
    case 'active':
      return 'Đang mở'
    case 'completed':
      return 'Đã kết thúc'
    case 'archived':
      return 'Lưu trữ'
    default:
      return status || '—'
  }
}
