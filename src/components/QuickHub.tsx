import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const ACTIONS: Array<{
  title: string
  blurb: string
  path: string
  module: string
  tone: string
}> = [
  {
    title: 'Xin nghỉ phép',
    blurb: 'Tạo yêu cầu PTO',
    path: '/leave',
    module: 'leave',
    tone: '#993556',
  },
  {
    title: 'Đề nghị công tác',
    blurb: 'Ước tính chi phí',
    path: '/travel/trips',
    module: 'trip',
    tone: '#E08A1E',
  },
  {
    title: 'Phiếu lương',
    blurb: 'Xem & tải về',
    path: '/payroll/payslips',
    module: 'pay',
    tone: '#185FA5',
  },
  {
    title: 'Cập nhật OKR',
    blurb: 'Tiến độ quý này',
    path: '/performance/okr',
    module: 'perf',
    tone: '#3B6D11',
  },
  {
    title: 'Hồ sơ nhân viên',
    blurb: 'Directory + ảnh',
    path: '/employees',
    module: 'emp',
    tone: '#0F6E56',
  },
  {
    title: 'Onboarding',
    blurb: 'Checklist nhận việc',
    path: '/recruitment/onboarding',
    module: 'rec',
    tone: '#993C1D',
  },
]

/** Workday-style quick actions for the hub / dashboard. */
export function QuickHub() {
  const { user } = useAuth()
  const allowed = new Set(user?.modules ?? [])
  const items = ACTIONS.filter(
    (a) => allowed.size === 0 || allowed.has(a.module),
  )

  if (items.length === 0) return null

  return (
    <section className="quick-hub" aria-label="Thao tác nhanh">
      <div className="quick-hub__head">
        <h2>Thao tác nhanh</h2>
      </div>
      <div className="quick-hub__grid">
        {items.map((a) => (
          <Link key={a.path} to={a.path} className="quick-hub__card">
            <span className="quick-hub__dot" style={{ background: a.tone }} />
            <span className="quick-hub__title">{a.title}</span>
            <span className="quick-hub__blurb">{a.blurb}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
