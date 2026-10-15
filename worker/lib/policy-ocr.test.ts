import { describe, expect, it } from 'vitest'
import { extractPolicyFieldsFromText } from './policy-ocr.ts'

describe('extractPolicyFieldsFromText', () => {
  it('parses Vietnamese policy headers', () => {
    const text = `
Mã chính sách: QD-IT-01
Tiêu đề: Quy định sử dụng thiết bị CNTT
Phiên bản: v2.0
Ngày hiệu lực: 01/01/2026
Người sở hữu: Trưởng phòng CNTT
Phòng ban áp dụng: Tất cả

Nhân viên Orange Cloud bắt buộc MFA và không chia sẻ mật khẩu.
`
    const e = extractPolicyFieldsFromText(text)
    expect(e.code).toMatch(/QD-IT-01/i)
    expect(e.title).toMatch(/thiết bị/i)
    expect(e.version).toMatch(/v?2\.0/i)
    expect(e.effective_from).toBe('2026-01-01')
    expect(e.owner_name).toMatch(/CNTT/i)
    expect(e.policy_type).toBe('IT')
  })
})
