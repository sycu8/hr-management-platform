/** Standard 8-item onboarding checklist (HRM Portal handoff). */
export const ONBOARDING_TASK_TITLES = [
  'Ký hợp đồng lao động',
  'Thu hồ sơ nhân sự (CCCD, bằng cấp, sổ BHXH)',
  'Tạo tài khoản email và hệ thống nội bộ',
  'Cấp thiết bị làm việc',
  'Giới thiệu nội quy và văn hóa công ty',
  'Gặp quản lý trực tiếp, thống nhất mục tiêu 30 ngày',
  'Đăng ký tham gia khóa đào tạo bắt buộc',
  'Đăng ký bảo hiểm xã hội',
] as const

export function defaultOnboardingTasks(
  doneCount = 0,
): { t: string; done: boolean }[] {
  return ONBOARDING_TASK_TITLES.map((t, i) => ({
    t,
    done: i < doneCount,
  }))
}

export function isHiredStage(stage: string | null | undefined): boolean {
  if (!stage) return false
  const s = stage.trim().toLowerCase()
  return s === 'hired' || s === 'nhận việc' || s === 'nhan viec'
}

export function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
