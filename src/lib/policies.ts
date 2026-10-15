/** Catalogs & helpers for Chính sách nội bộ (Policies). */

export const POLICY_CATEGORIES = ['Quy định', 'Quy trình', 'Pháp lý'] as const
export type PolicyCategory = (typeof POLICY_CATEGORIES)[number]

export const POLICY_TYPES = [
  'HR',
  'IT',
  'An toàn',
  'Tài chính',
  'Pháp lý',
  'Chung',
] as const
export type PolicyType = (typeof POLICY_TYPES)[number]

export const POLICY_STATUSES = [
  { value: 'draft', label: 'Nháp' },
  { value: 'active', label: 'Đang hiệu lực' },
  { value: 'expired', label: 'Hết hiệu lực' },
] as const
export type PolicyStatus = (typeof POLICY_STATUSES)[number]['value']

export type PolicyDocument = {
  id: string
  category: PolicyCategory | string
  code: string
  title: string
  policy_type: string | null
  version: string | null
  effective_from: string | null
  effective_to: string | null
  status: PolicyStatus | string | null
  applicable_departments: string | null
  summary: string | null
  content_text: string | null
  body_json?: string | null
  file_name: string | null
  content_type: string | null
  size_bytes: number | null
  r2_key: string | null
  owner_name: string | null
  owner_user_id: string | null
  last_reviewed_at: string | null
  updated_at?: string | null
}

export type PolicyOcrDraft = {
  code?: string | null
  title?: string | null
  category?: string | null
  policy_type?: string | null
  version?: string | null
  effective_from?: string | null
  effective_to?: string | null
  status?: string | null
  applicable_departments?: string | null
  summary?: string | null
  content_text?: string | null
  owner_name?: string | null
}

export function policyStatusLabel(status: string | null | undefined): string {
  const found = POLICY_STATUSES.find((s) => s.value === status)
  return found?.label ?? status ?? '—'
}

export function departmentsDisplay(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '' || raw === '[]') return 'Tất cả'
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return 'Tất cả'
      return parsed.map(String).join(', ')
    }
  } catch {
    /* plain text */
  }
  return raw
}
