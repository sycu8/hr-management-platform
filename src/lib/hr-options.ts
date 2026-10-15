/** Catalogs an HR supervisor uses when maintaining employee records (VN). */

export const GENDERS = ['Nam', 'Nữ', 'Khác'] as const

export const DEPARTMENTS = [
  'Ban giám đốc',
  'Nhân sự',
  'Kinh doanh',
  'Kỹ thuật',
  'Marketing',
  'Kế toán',
  'Customer Success',
  'Hành chính',
] as const

export const CONTRACT_TYPES = [
  'Thử việc',
  'Xác định thời hạn 12 tháng',
  'Xác định thời hạn 24 tháng',
  'Xác định thời hạn 36 tháng',
  'Không xác định thời hạn',
  'Cộng tác viên / HĐDV',
] as const

/** Grade / band used for travel per-diem and org chart. */
export const LEVEL_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '0 — Nhân viên / Junior' },
  { value: 1, label: '1 — Chuyên viên / Team lead' },
  { value: 2, label: '2 — Trưởng phòng / Manager' },
  { value: 3, label: '3 — Giám đốc / Executive' },
]

export const EMP_STATUS = [
  { value: 'active', label: 'Đang làm việc' },
  { value: 'left', label: 'Đã nghỉ việc' },
] as const
