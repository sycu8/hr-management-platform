import { NAV_MAP, type NavItem, type NavModule } from './nav'

export type SearchPageHit = {
  kind: 'page'
  id: string
  title: string
  path: string
  moduleKey: string
  moduleName: string
  moduleColor: string
  keywords: string[]
  blurb: string
}

/** Extra Vietnamese / Workday-style aliases for page discovery. */
const PAGE_EXTRA: Record<
  string,
  { keywords: string[]; blurb: string }
> = {
  dash: {
    keywords: ['dashboard', 'tổng quan', 'home', 'trang chủ', 'overview'],
    blurb: 'KPI nhân sự, biểu đồ và việc cần xử lý',
  },
  presence: {
    keywords: ['hiện diện', 'turnover', 'nghỉ việc', 'attendance rate'],
    blurb: 'Tỷ lệ hiện diện và biến động nhân sự',
  },
  alerts: {
    keywords: ['cảnh báo', 'nhắc việc', 'todo', 'inbox', 'thông báo'],
    blurb: 'Việc đến hạn cần hành động',
  },
  events: {
    keywords: [
      'sự kiện',
      'sinh nhật',
      'lịch',
      'calendar',
      'nghỉ phép',
      'công tác',
      '45 ngày',
    ],
    blurb: 'Lịch 45 ngày — nghỉ phép, công tác, sự kiện công ty',
  },
  emp: {
    keywords: ['nhân viên', 'hồ sơ', 'profile', 'directory', 'danh bạ', 'worker'],
    blurb: 'Danh sách hồ sơ cá nhân kèm ảnh',
  },
  jobs: {
    keywords: ['chức danh', 'job profile', 'cấp bậc', 'vị trí'],
    blurb: 'Hồ sơ công việc & tổ chức',
  },
  hist: {
    keywords: ['lịch sử', 'thuyên chuyển', 'công tác'],
    blurb: 'Timeline sự kiện nhân sự',
  },
  docs: {
    keywords: ['tài liệu', 'hồ sơ đính kèm', 'cccd', 'bằng cấp'],
    blurb: 'Tài liệu nhân viên',
  },
  joblist: {
    keywords: ['tuyển dụng', 'jd', 'đăng tin', 'recruiting', 'job req'],
    blurb: 'Tin tuyển dụng & JD',
  },
  cands: {
    keywords: ['ứng viên', 'candidate', 'pipeline', 'kanban'],
    blurb: 'Theo dõi ứng viên theo giai chuyền',
  },
  onb: {
    keywords: ['onboarding', 'nhận việc', 'checklist', 'thử việc'],
    blurb: 'Checklist nhân viên mới',
  },
  leave: {
    keywords: ['nghỉ phép', 'xin phép', 'pto', 'time off', 'leave'],
    blurb: 'Đăng ký và duyệt nghỉ phép',
  },
  quota: {
    keywords: ['số dư phép', 'quota', 'phép năm'],
    blurb: 'Quota & số dư ngày phép',
  },
  att: {
    keywords: ['chấm công', 'timesheet', 'giờ vào'],
    blurb: 'Chấm công hàng ngày',
  },
  cal: {
    keywords: ['lịch team', 'team calendar', 'ai nghỉ'],
    blurb: 'Lịch nghỉ của nhóm',
  },
  'trip-ov': {
    keywords: ['công tác', 'travel', 'overview'],
    blurb: 'Tổng quan công tác',
  },
  trips: {
    keywords: ['đề nghị công tác', 'work trip', 'đi công tác'],
    blurb: 'Tạo và theo dõi đề nghị đi công tác',
  },
  appr: {
    keywords: ['phê duyệt công tác', 'duyệt trip'],
    blurb: 'Phê duyệt đề nghị công tác',
  },
  settle: {
    keywords: ['quyết toán', 'hoàn ứng', 'expense'],
    blurb: 'Quyết toán công tác phí',
  },
  policy: {
    keywords: ['chính sách công tác', 'định mức', 'per diem'],
    blurb: 'Policy công tác phí',
  },
  report: {
    keywords: ['báo cáo công tác', 'travel report'],
    blurb: 'Báo cáo công tác',
  },
  payroll: {
    keywords: ['bảng lương', 'payroll', 'lương', 'gross', 'net', 'tncn'],
    blurb: 'Bảng lương tháng — tải CSV/Excel',
  },
  payslip: {
    keywords: ['phiếu lương', 'payslip', 'slip', 'lương thực nhận'],
    blurb: 'Phiếu lương điện tử chi tiết',
  },
  allow: {
    keywords: ['phụ cấp', 'thưởng', 'bonus', 'allowance'],
    blurb: 'Phụ cấp & thưởng',
  },
  ins: {
    keywords: ['bảo hiểm', 'bhxh', 'bhyt', 'bhtn', 'insurance'],
    blurb: 'Đóng BHXH / BHYT / BHTN',
  },
  cycles: {
    keywords: ['chu kỳ đánh giá', 'review cycle', 'appraisal'],
    blurb: 'Chu kỳ đánh giá hiệu suất',
  },
  okr: {
    keywords: ['okr', 'kpi', 'mục tiêu', 'goal', 'key result'],
    blurb: 'KPI / OKR theo quý và năm',
  },
  f360: {
    keywords: ['360', 'đánh giá 360', 'feedback', 'radar'],
    blurb: 'Đánh giá 360 độ + phân tích AI',
  },
  perfhist: {
    keywords: ['lịch sử hiệu suất', 'rating history'],
    blurb: 'Lịch sử điểm hiệu suất',
  },
  courses: {
    keywords: ['đào tạo', 'khóa học', 'learning', 'lms', 'course'],
    blurb: 'Chương trình đào tạo',
  },
  progress: {
    keywords: ['tiến độ học', 'enrollment', 'học viên'],
    blurb: 'Tiến độ ghi danh khóa học',
  },
  certs: {
    keywords: ['chứng chỉ', 'certificate'],
    blurb: 'Chứng chỉ nội bộ',
  },
  careers: {
    keywords: ['lộ trình', 'career', 'career path', 'bậc nghề'],
    blurb: 'Lộ trình nghề nghiệp',
  },
  'pol-rule': {
    keywords: ['nội quy', 'quy định', 'policy', 'handbook'],
    blurb: 'Quy định công ty',
  },
  'pol-sop': {
    keywords: ['sop', 'quy trình', 'procedure'],
    blurb: 'Quy trình & SOP',
  },
  'pol-law': {
    keywords: ['pháp lý', 'luật', 'legal', 'văn bản'],
    blurb: 'Văn bản pháp lý',
  },
  perms: {
    keywords: ['phân quyền', 'role', 'permission', 'rbac', 'user admin'],
    blurb: 'Phân quyền người dùng',
  },
  security: {
    keywords: ['bảo mật', 'security', '2fa', 'mask salary'],
    blurb: 'Bảo mật dữ liệu',
  },
  integ: {
    keywords: ['tích hợp', 'integration', 'data source', 'api'],
    blurb: 'Tích hợp nguồn dữ liệu',
  },
  export: {
    keywords: ['xuất dữ liệu', 'export', 'báo cáo', 'csv'],
    blurb: 'Báo cáo & xuất dữ liệu',
  },
}

export function buildPageCatalog(
  allowedModules?: Set<string> | string[],
): SearchPageHit[] {
  const allowed =
    allowedModules == null
      ? null
      : allowedModules instanceof Set
        ? allowedModules
        : new Set(allowedModules)

  const hits: SearchPageHit[] = []
  for (const mod of NAV_MAP) {
    if (allowed && allowed.size > 0 && !allowed.has(mod.key)) continue
    for (const item of mod.items) {
      const extra = PAGE_EXTRA[item.id]
      hits.push({
        kind: 'page',
        id: item.id,
        title: item.title,
        path: item.path,
        moduleKey: mod.key,
        moduleName: mod.name,
        moduleColor: mod.color,
        keywords: [
          item.title,
          mod.name,
          item.path,
          item.id,
          ...(extra?.keywords ?? []),
        ].map((k) => k.toLowerCase()),
        blurb: extra?.blurb ?? mod.name,
      })
    }
  }
  return hits
}

export function scorePageHit(hit: SearchPageHit, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const tokens = q.split(/\s+/).filter(Boolean)
  let score = 0
  for (const t of tokens) {
    if (hit.title.toLowerCase().includes(t)) score += 8
    if (hit.moduleName.toLowerCase().includes(t)) score += 3
    if (hit.blurb.toLowerCase().includes(t)) score += 2
    if (hit.keywords.some((k) => k.includes(t) || t.includes(k))) score += 5
    if (hit.path.toLowerCase().includes(t)) score += 2
  }
  if (hit.title.toLowerCase().startsWith(q)) score += 4
  return score
}

export function suggestPages(
  query: string,
  allowedModules?: Set<string> | string[],
  limit = 8,
): SearchPageHit[] {
  const catalog = buildPageCatalog(allowedModules)
  if (!query.trim()) {
    return catalog.slice(0, limit)
  }
  return catalog
    .map((hit) => ({ hit, score: scorePageHit(hit, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.hit)
}

export function moduleOfItem(item: NavItem): NavModule | undefined {
  return NAV_MAP.find((m) => m.items.some((i) => i.id === item.id))
}
