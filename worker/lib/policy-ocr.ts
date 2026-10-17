/**
 * Policy document text extraction for Cloudflare Workers.
 * Prefers AI.toMarkdown; falls back to UTF-8 text / empty + note when AI missing.
 */

export type PolicySection = { h: string; b: string }

export type ExtractedPolicyFields = {
  code: string | null
  title: string | null
  policy_type: string | null
  version: string | null
  effective_from: string | null
  effective_to: string | null
  status: 'draft' | 'active' | 'expired'
  applicable_departments: string | null
  summary: string | null
  owner_name: string | null
}

export function markdownToSections(md: string): PolicySection[] {
  const text = md.replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const parts = text.split(/^#{1,3}\s+/m).filter((p) => p.trim())
  if (parts.length <= 1 && !/^#{1,3}\s+/m.test(text)) {
    return [{ h: 'Nội dung OCR', b: text.slice(0, 20_000) }]
  }

  const sections: PolicySection[] = []
  for (const part of parts) {
    const nl = part.indexOf('\n')
    const h =
      (nl === -1 ? part : part.slice(0, nl)).trim().slice(0, 200) || 'Mục'
    const b = (nl === -1 ? '' : part.slice(nl + 1)).trim().slice(0, 20_000)
    if (h || b) sections.push({ h, b })
  }
  return sections.length
    ? sections
    : [{ h: 'Nội dung OCR', b: text.slice(0, 20_000) }]
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  const vn = s.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i)
  if (vn) {
    return `${vn[3]}-${vn[2].padStart(2, '0')}-${vn[1].padStart(2, '0')}`
  }
  return null
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

/** Heuristic mapping from Vietnamese policy OCR/paste text → draft fields. */
export function extractPolicyFieldsFromText(raw: string): ExtractedPolicyFields {
  const text = raw.replace(/\u0000/g, '').trim()
  const code = firstMatch(text, [
    /(?:mã\s*(?:chính\s*sách|văn\s*bản|số)|số\s*hiệu)\s*[:：]?\s*([A-Z0-9ĐƯƠĂÂÊÔ\/\-_]+)/i,
    /\b((?:QD|QĐ|QT|SOP|PL|CS)[-_]?[A-Z0-9\/\-]+)\b/i,
  ])
  const title = firstMatch(text, [
    /(?:tiêu\s*đề|tên\s*(?:văn\s*bản|chính\s*sách)|về\s*việc)\s*[:：]\s*(.+)/i,
    /^(?:QUY\s*(?:ĐỊNH|CHẾ|TRÌNH)|NỘI\s*QUY|SOP)[^\n]{4,120}/im,
  ])
  const version = firstMatch(text, [
    /(?:phiên\s*bản|version|rev(?:ision)?)\s*[:：]?\s*(v?\d+(?:\.\d+)*)/i,
  ])
  const effective_from = normalizeDate(
    firstMatch(text, [
      /(?:ngày\s*)?(?:hiệu\s*lực|áp\s*dụng|ban\s*hành)\s*(?:từ\s*)?[:：]?\s*([^\n,]{6,40})/i,
      /có\s*hiệu\s*lực\s*(?:từ\s*)?(?:ngày\s*)?([^\n,]{6,40})/i,
    ]) ?? '',
  )
  const effective_to = normalizeDate(
    firstMatch(text, [
      /(?:hết\s*hiệu\s*lực|hiệu\s*lực\s*đến|đến\s*ngày)\s*[:：]?\s*([^\n,]{6,40})/i,
    ]) ?? '',
  )
  const owner_name = firstMatch(text, [
    /(?:người\s*sở\s*hữu|phụ\s*trách|ban\s*hành\s*bởi|owner)\s*[:：]\s*([^\n]{3,80})/i,
  ])
  const applicable_departments = firstMatch(text, [
    /(?:phòng\s*ban\s*áp\s*dụng|áp\s*dụng\s*cho|phạm\s*vi)\s*[:：]\s*([^\n]{2,120})/i,
  ])

  const hay = `${title ?? ''}\n${text}`.toLowerCase()
  let policy_type: string | null = 'Chung'
  if (/an toàn|pccc|atld/.test(hay)) policy_type = 'An toàn'
  else if (/cntt|công nghệ|it\b|bảo mật thông tin|an ninh mạng/.test(hay))
    policy_type = 'IT'
  else if (/tài chính|kế toán|công tác phí|lương|bhxh/.test(hay))
    policy_type = 'Tài chính'
  else if (/pháp lý|luật|nghị định|thông tư/.test(hay)) policy_type = 'Pháp lý'
  else if (/nhân sự|nghỉ phép|tuyển dụng|nội quy|chấm công/.test(hay))
    policy_type = 'HR'

  const today = new Date().toISOString().slice(0, 10)
  let status: ExtractedPolicyFields['status'] = 'active'
  if (effective_to && effective_to < today) status = 'expired'
  else if (effective_from && effective_from > today) status = 'draft'

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 20)
  const summary = (
    lines.find((l) => /tóm tắt|mục đích|phạm vi/i.test(l)) ??
    lines[0] ??
    title ??
    ''
  ).slice(0, 280)

  return {
    code,
    title: title ? title.replace(/\s+/g, ' ').slice(0, 200) : null,
    policy_type,
    version,
    effective_from,
    effective_to,
    status,
    applicable_departments,
    summary: summary || null,
    owner_name,
  }
}

export type OcrExtractResult = {
  markdown: string
  method: 'ai_tomarkdown' | 'utf8_text' | 'unavailable'
  note: string | null
}

export async function extractMarkdownFromR2Object(
  ai: Ai | undefined,
  fileName: string,
  mime: string,
  buffer: ArrayBuffer,
): Promise<OcrExtractResult> {
  if (
    mime.startsWith('text/') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.csv')
  ) {
    return {
      markdown: new TextDecoder('utf-8').decode(buffer),
      method: 'utf8_text',
      note: null,
    }
  }

  if (!ai || typeof ai.toMarkdown !== 'function') {
    return {
      markdown: '',
      method: 'unavailable',
      note:
        'AI chưa khả dụng. File đã lưu — dán văn bản OCR thủ công hoặc điền form.',
    }
  }

  try {
    const result = await ai.toMarkdown({
      name: fileName,
      blob: new Blob([buffer], { type: mime }),
    })
    // Runtime shape varies by wrangler version
    const r = result as {
      format?: string
      error?: string
      data?: string
    }
    if (r.format === 'error') {
      return {
        markdown: '',
        method: 'unavailable',
        note: r.error || 'toMarkdown failed',
      }
    }
    const data = typeof r.data === 'string' ? r.data : ''
    if (!data.trim()) {
      return {
        markdown: '',
        method: 'ai_tomarkdown',
        note: 'AI không trích được chữ — hãy dán nội dung thủ công.',
      }
    }
    return { markdown: data, method: 'ai_tomarkdown', note: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      markdown: '',
      method: 'unavailable',
      note: `OCR lỗi: ${message}. File vẫn còn — điền form hoặc dán text.`,
    }
  }
}
