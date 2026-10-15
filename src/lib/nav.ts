export type NavItem = {
  id: string
  title: string
  path: string
}

export type NavModule = {
  key: string
  name: string
  color: string
  isNew?: boolean
  items: NavItem[]
}

/** Navigation MAP from the HRM Portal handoff. */
export const NAV_MAP: NavModule[] = [
  {
    key: 'dash',
    name: 'Bảng điều khiển',
    color: '#534AB7',
    items: [
      { id: 'dash', title: 'Tổng quan nhân sự', path: '/' },
      { id: 'presence', title: 'Tỷ lệ hiện diện / nghỉ việc', path: '/presence' },
      { id: 'alerts', title: 'Cảnh báo & nhắc việc', path: '/alerts' },
      { id: 'events', title: 'Sự kiện sắp tới', path: '/events' },
    ],
  },
  {
    key: 'emp',
    name: 'Quản lý nhân viên',
    color: '#0F6E56',
    items: [
      { id: 'emp', title: 'Hồ sơ cá nhân', path: '/employees' },
      { id: 'jobs', title: 'Hồ sơ công việc', path: '/employees/jobs' },
      { id: 'hist', title: 'Lịch sử công tác', path: '/employees/history' },
      { id: 'docs', title: 'Tài liệu đính kèm', path: '/employees/docs' },
    ],
  },
  {
    key: 'rec',
    name: 'Tuyển dụng',
    color: '#993C1D',
    items: [
      { id: 'joblist', title: 'Đăng tin & JD', path: '/recruitment/jobs' },
      { id: 'cands', title: 'Theo dõi ứng viên', path: '/recruitment/candidates' },
      { id: 'onb', title: 'Onboarding', path: '/recruitment/onboarding' },
    ],
  },
  {
    key: 'leave',
    name: 'Nghỉ phép & chấm công',
    color: '#993556',
    items: [
      { id: 'leave', title: 'Đăng ký nghỉ phép', path: '/leave' },
      { id: 'quota', title: 'Quota & số dư phép', path: '/leave/quota' },
      { id: 'att', title: 'Chấm công', path: '/attendance' },
      { id: 'cal', title: 'Lịch nghỉ team', path: '/leave/calendar' },
    ],
  },
  {
    key: 'trip',
    name: 'Công tác & công tác phí',
    color: '#E08A1E',
    isNew: true,
    items: [
      { id: 'trip-ov', title: 'Tổng quan công tác', path: '/travel' },
      { id: 'trips', title: 'Đề nghị công tác', path: '/travel/trips' },
      { id: 'appr', title: 'Phê duyệt', path: '/travel/approvals' },
      { id: 'settle', title: 'Quyết toán', path: '/travel/settlements' },
      { id: 'policy', title: 'Chính sách công tác phí', path: '/travel/policy' },
      { id: 'report', title: 'Báo cáo công tác', path: '/travel/reports' },
    ],
  },
  {
    key: 'pay',
    name: 'Lương & phúc lợi',
    color: '#185FA5',
    items: [
      { id: 'payroll', title: 'Bảng lương hàng tháng', path: '/payroll' },
      { id: 'payslip', title: 'Phiếu lương điện tử', path: '/payroll/payslips' },
      { id: 'allow', title: 'Phụ cấp & thưởng', path: '/payroll/allowances' },
      { id: 'ins', title: 'Bảo hiểm XH/YT', path: '/payroll/insurance' },
    ],
  },
  {
    key: 'perf',
    name: 'Đánh giá hiệu suất',
    color: '#3B6D11',
    items: [
      { id: 'cycles', title: 'Chu kỳ đánh giá', path: '/performance/cycles' },
      { id: 'okr', title: 'KPI / OKR', path: '/performance/okr' },
      { id: 'f360', title: 'Đánh giá 360 độ', path: '/performance/360' },
      { id: 'perfhist', title: 'Lịch sử hiệu suất', path: '/performance/history' },
    ],
  },
  {
    key: 'learn',
    name: 'Đào tạo & phát triển',
    color: '#854F0B',
    items: [
      { id: 'courses', title: 'Chương trình đào tạo', path: '/learning/courses' },
      { id: 'progress', title: 'Tiến độ học', path: '/learning/progress' },
      { id: 'certs', title: 'Chứng chỉ nội bộ', path: '/learning/certificates' },
      { id: 'careers', title: 'Lộ trình nghề nghiệp', path: '/learning/careers' },
    ],
  },
  {
    key: 'pol',
    name: 'Chính sách nội bộ',
    color: '#A32D2D',
    items: [
      { id: 'pol-rule', title: 'Quy định công ty', path: '/policies/rules' },
      { id: 'pol-sop', title: 'Quy trình & SOP', path: '/policies/sop' },
      { id: 'pol-law', title: 'Văn bản pháp lý', path: '/policies/legal' },
    ],
  },
  {
    key: 'sys',
    name: 'Quản trị hệ thống',
    color: '#5F5E5A',
    items: [
      { id: 'perms', title: 'Phân quyền người dùng', path: '/admin/permissions' },
      { id: 'security', title: 'Bảo mật dữ liệu', path: '/admin/security' },
      {
        id: 'integ',
        title: 'Tích hợp nguồn dữ liệu',
        path: '/admin/integrations',
      },
      { id: 'export', title: 'Báo cáo & xuất dữ liệu', path: '/admin/exports' },
    ],
  },
]

export const ALL_NAV_ITEMS: NavItem[] = NAV_MAP.flatMap((m) => m.items)

export function findNavItem(pathname: string): NavItem | undefined {
  const exact = ALL_NAV_ITEMS.find((i) => i.path === pathname)
  if (exact) return exact
  return ALL_NAV_ITEMS.find(
    (i) => i.path !== '/' && pathname.startsWith(`${i.path}/`),
  )
}

export function findNavModule(pathname: string): NavModule | undefined {
  const item = findNavItem(pathname)
  if (!item) return undefined
  return NAV_MAP.find((m) => m.items.some((i) => i.id === item.id))
}

export function pageTitle(pathname: string): string {
  return findNavItem(pathname)?.title ?? 'HRM Portal'
}
