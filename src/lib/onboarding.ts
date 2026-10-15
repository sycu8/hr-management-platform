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

export type OnboardingTask = {
  t?: string
  title?: string
  done: boolean
  due?: string
}

export function taskLabel(task: OnboardingTask): string {
  return (task.t ?? task.title ?? '').trim()
}

export function parseTasks(raw: unknown): OnboardingTask[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        return {
          t: typeof o.t === 'string' ? o.t : undefined,
          title: typeof o.title === 'string' ? o.title : undefined,
          done: Boolean(o.done),
          due: typeof o.due === 'string' ? o.due : undefined,
        }
      }
      return { t: String(item ?? ''), done: false }
    })
  }
  if (typeof raw === 'string') {
    try {
      return parseTasks(JSON.parse(raw || '[]') as unknown)
    } catch {
      return []
    }
  }
  return []
}

export function defaultOnboardingTasks(
  doneCount = 0,
): { t: string; done: boolean }[] {
  return ONBOARDING_TASK_TITLES.map((t, i) => ({
    t,
    done: i < doneCount,
  }))
}

/** Days from local today until ISO date; positive = future. */
export function daysUntil(isoDate: string, today = new Date()): number {
  const target = new Date(`${isoDate.slice(0, 10)}T12:00:00`)
  const base = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
    0,
    0,
    0,
  )
  return Math.round((target.getTime() - base.getTime()) / 86400000)
}

export function formatJoinDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}
