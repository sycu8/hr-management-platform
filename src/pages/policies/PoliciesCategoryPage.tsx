import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { DEPARTMENTS } from '../../lib/hr-options'
import {
  departmentsDisplay,
  POLICY_STATUSES,
  POLICY_TYPES,
  policyStatusLabel,
  type PolicyCategory,
} from '../../lib/policies'

type Section = { h: string; b: string }

type PolicyListItem = {
  id: string
  category: string
  code: string
  title: string
  version: string | null
  policy_type?: string | null
  effective_from: string | null
  effective_to?: string | null
  status?: string | null
  applicable_departments?: string | null
  summary: string | null
  owner_name?: string | null
  last_reviewed_at?: string | null
  file_name?: string | null
  r2_key?: string | null
  attachment_count?: number
}

type Attachment = {
  id: string
  policy_id: string
  file_name: string
  content_type: string | null
  size_bytes: number
  r2_key: string
  uploaded_by: string | null
  ocr_status: string
  ocr_error: string | null
  created_at: string
}

type PolicyDetail = PolicyListItem & {
  content_text?: string | null
  body: {
    sections: Section[]
    ocr_source_attachment_id?: string
    ocr_at?: string
  }
}

type FormState = {
  code: string
  title: string
  policy_type: string
  version: string
  effective_from: string
  effective_to: string
  status: string
  applicable_departments: string
  summary: string
  content_text: string
  sectionsText: string
  owner_name: string
  last_reviewed_at: string
}

type OcrExtracted = {
  code?: string | null
  title?: string | null
  policy_type?: string | null
  version?: string | null
  effective_from?: string | null
  effective_to?: string | null
  status?: string | null
  applicable_departments?: string | null
  summary?: string | null
  owner_name?: string | null
}

function sectionsToText(sections: Section[]): string {
  return sections.map((s) => `## ${s.h}\n${s.b}`.trim()).join('\n\n')
}

function textToSections(text: string): Section[] {
  const parts = text
    .replace(/\r\n/g, '\n')
    .split(/^##\s+/m)
    .filter((p) => p.trim())
  if (parts.length === 0) return []
  if (parts.length === 1 && !text.trim().startsWith('##')) {
    const body = text.trim()
    return body ? [{ h: 'Nội dung', b: body }] : []
  }
  return parts.map((part) => {
    const nl = part.indexOf('\n')
    const h = (nl === -1 ? part : part.slice(0, nl)).trim() || 'Mục'
    const b = (nl === -1 ? '' : part.slice(nl + 1)).trim()
    return { h, b }
  })
}

function emptyForm(): FormState {
  return {
    code: '',
    title: '',
    policy_type: 'HR',
    version: 'v1.0',
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
    status: 'draft',
    applicable_departments: 'Tất cả',
    summary: '',
    content_text: '',
    sectionsText: '',
    owner_name: '',
    last_reviewed_at: new Date().toISOString().slice(0, 10),
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function applyExtracted(form: FormState, e: OcrExtracted, markdown: string): FormState {
  return {
    ...form,
    code: e.code || form.code,
    title: e.title || form.title,
    policy_type: e.policy_type || form.policy_type,
    version: e.version || form.version,
    effective_from: e.effective_from || form.effective_from,
    effective_to: e.effective_to || form.effective_to,
    status: e.status || form.status,
    applicable_departments:
      e.applicable_departments || form.applicable_departments,
    summary: e.summary || form.summary,
    owner_name: e.owner_name || form.owner_name,
    content_text: markdown || form.content_text,
    sectionsText: markdown
      ? markdown.includes('##')
        ? markdown
        : sectionsToText([{ h: 'Nội dung OCR', b: markdown }])
      : form.sectionsText,
  }
}

export function PoliciesCategoryPage({
  category,
  title,
  description,
}: {
  category: PolicyCategory
  title: string
  description: string
}) {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const fileRef = useRef<HTMLInputElement>(null)
  const ocrFileRef = useRef<HTMLInputElement>(null)

  const [items, setItems] = useState<PolicyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetchJson<{ items: PolicyListItem[] }>(
      `/api/policies?category=${encodeURIComponent(category)}`,
    )
      .then((r) => {
        setItems(r.items ?? [])
        setError(null)
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Không tải được'),
      )
      .finally(() => setLoading(false))
  }, [category])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setMsg(null)
    setPasteText('')
    setEditId(null)
    setAttachments([])
    setForm(emptyForm())
  }

  async function openEdit(id: string) {
    setMsg(null)
    setPasteText('')
    setEditId(id)
    const res = await fetchJson<{
      policy: PolicyDetail
      attachments: Attachment[]
    }>(`/api/policies/${id}`)
    const p = res.policy
    setForm({
      code: p.code,
      title: p.title,
      policy_type: p.policy_type ?? 'Chung',
      version: p.version ?? '',
      effective_from: p.effective_from ?? '',
      effective_to: p.effective_to ?? '',
      status: p.status ?? 'active',
      applicable_departments: departmentsDisplay(p.applicable_departments),
      summary: p.summary ?? '',
      content_text: p.content_text ?? '',
      sectionsText: sectionsToText(p.body?.sections ?? []),
      owner_name: p.owner_name ?? '',
      last_reviewed_at: p.last_reviewed_at ?? '',
    })
    setAttachments(res.attachments ?? [])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setMsg(null)
    try {
      const sections = textToSections(
        form.sectionsText || form.content_text,
      )
      const payload = {
        category,
        code: form.code.trim(),
        title: form.title.trim(),
        policy_type: form.policy_type || null,
        version: form.version.trim() || null,
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null,
        status: form.status,
        applicable_departments: form.applicable_departments || null,
        summary: form.summary.trim() || null,
        content_text: form.content_text || form.sectionsText || null,
        owner_name: form.owner_name || null,
        last_reviewed_at: form.last_reviewed_at || null,
        body_json: { sections },
      }
      if (editId) {
        await fetchJson(`/api/policies/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        const created = await fetchJson<{ policy: PolicyDetail }>(
          '/api/policies',
          { method: 'POST', body: JSON.stringify(payload) },
        )
        setEditId(created.policy.id)
      }
      setMsg('Đã lưu. Xác nhận thành công.')
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  async function removePolicy() {
    if (!editId) return
    if (!window.confirm('Xóa văn bản và toàn bộ tệp đính kèm trên R2?')) return
    setSaving(true)
    setMsg(null)
    try {
      await fetchJson(`/api/policies/${editId}`, { method: 'DELETE' })
      setForm(null)
      setEditId(null)
      setAttachments([])
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không xóa được')
    } finally {
      setSaving(false)
    }
  }

  async function ensureDraftId(base: FormState): Promise<string> {
    if (editId) return editId
    const stamp = Date.now().toString(36).slice(-4).toUpperCase()
    const created = await fetchJson<{ policy: PolicyDetail }>('/api/policies', {
      method: 'POST',
      body: JSON.stringify({
        category,
        code: base.code.trim() || `OCR-${stamp}`,
        title: base.title.trim() || `OCR ${stamp}`,
        policy_type: base.policy_type || 'Chung',
        version: base.version || null,
        status: 'draft',
        summary: base.summary || null,
        owner_name: base.owner_name || user?.displayName || null,
        body_json: { sections: [] },
      }),
    })
    setEditId(created.policy.id)
    return created.policy.id
  }

  async function uploadFile(file: File, policyId: string): Promise<Attachment> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/policies/${policyId}/attachments`, {
      method: 'POST',
      credentials: 'same-origin',
      body: fd,
    })
    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = (await res.json()) as { error?: { message?: string } }
        if (body.error?.message) detail = body.error.message
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail)
    }
    const data = (await res.json()) as { attachment: Attachment }
    return data.attachment
  }

  async function runOcrOnAttachment(
    attachmentId: string,
    currentForm: FormState,
  ) {
    const res = await fetchJson<{
      method: string
      markdown: string
      sections: Section[]
      extracted?: OcrExtracted
      note?: string | null
      ai_available?: boolean
      policy: PolicyDetail | null
    }>(`/api/policies/attachments/${attachmentId}/ocr?apply=0`, {
      method: 'POST',
    })

    let next = { ...currentForm }
    if (res.extracted) {
      next = applyExtracted(next, res.extracted, res.markdown)
    }
    if (res.sections?.length) {
      next.sectionsText = sectionsToText(res.sections)
      next.content_text = res.markdown || next.content_text
    } else if (res.markdown) {
      next.content_text = res.markdown
      next.sectionsText = sectionsToText([{ h: 'Nội dung OCR', b: res.markdown }])
    }
    if (res.policy) {
      next.code = res.policy.code || next.code
      next.title = res.policy.title || next.title
      next.summary = res.policy.summary ?? next.summary
    }
    setForm(next)
    if (res.markdown) setPasteText(res.markdown)

    const bits = [
      `OCR: ${res.method}`,
      res.ai_available === false ? 'AI chưa bind' : null,
      res.note,
      'Xem trước form — bấm «Xác nhận lưu» để ghi vào DB.',
    ].filter(Boolean)
    setMsg(bits.join(' · '))
  }

  async function uploadAndOcr(file: File) {
    if (!form) return
    setOcrBusy(true)
    setUploading(true)
    setMsg(null)
    try {
      const policyId = await ensureDraftId(form)
      const att = await uploadFile(file, policyId)
      setAttachments((prev) => [att, ...prev])
      await runOcrOnAttachment(att.id, form)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Upload/OCR thất bại')
    } finally {
      setOcrBusy(false)
      setUploading(false)
      if (ocrFileRef.current) ocrFileRef.current.value = ''
    }
  }

  async function uploadOnly(file: File) {
    if (!form) return
    setUploading(true)
    setMsg(null)
    try {
      const policyId = await ensureDraftId(form)
      const att = await uploadFile(file, policyId)
      setAttachments((prev) => [att, ...prev])
      setMsg(`Đã lưu lên R2: ${att.file_name}`)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Upload thất bại')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function applyPastedText() {
    if (!form || !pasteText.trim()) return
    const sections = textToSections(
      pasteText.includes('##')
        ? pasteText
        : `## Nội dung\n${pasteText}`,
    )
    // Lightweight client-side heuristics via a text file OCR path when we have an id
    setForm({
      ...form,
      content_text: pasteText,
      sectionsText: sectionsToText(sections),
      summary: form.summary || pasteText.split('\n').find((l) => l.trim().length > 20)?.slice(0, 280) || form.summary,
    })
    setMsg('Đã áp dụng văn bản dán thủ công vào form — kiểm tra rồi xác nhận lưu.')
  }

  async function removeAttachment(attachmentId: string) {
    if (!window.confirm('Xóa tệp khỏi R2 và metadata D1?')) return
    setMsg(null)
    try {
      await fetchJson(`/api/policies/attachments/${attachmentId}`, {
        method: 'DELETE',
      })
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không xóa được tệp')
    }
  }

  if (form) {
    return (
      <div className="card">
        <h2>{editId ? `Sửa: ${form.code || title}` : `Thêm — ${title}`}</h2>
        <p className="muted">
          File lưu trên R2 (DOCUMENTS). OCR dùng Workers AI khi có binding; nếu
          không, vẫn upload được và điền/dán thủ công.
        </p>
        {msg ? <p className="warn-text">{msg}</p> : null}

        {canEdit ? (
          <div className="toolbar" style={{ marginBottom: '1rem' }}>
            <input
              ref={ocrFileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.doc,.docx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadAndOcr(f)
              }}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.doc,.docx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadOnly(f)
              }}
            />
            <button
              type="button"
              className="btn primary"
              disabled={ocrBusy || uploading}
              onClick={() => ocrFileRef.current?.click()}
            >
              {ocrBusy ? 'Đang OCR…' : 'Upload & OCR'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={uploading || ocrBusy}
              onClick={() => fileRef.current?.click()}
            >
              Chỉ đính kèm
            </button>
          </div>
        ) : null}

        <form className="hr-form" onSubmit={(e) => void save(e)}>
          <fieldset>
            <legend>Thông tin chính sách</legend>
            <div className="form-grid">
              <label>
                Mã chính sách *
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  className="mono"
                />
              </label>
              <label>
                Loại
                <select
                  value={form.policy_type}
                  onChange={(e) =>
                    setForm({ ...form, policy_type: e.target.value })
                  }
                >
                  {POLICY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span2">
                Tiêu đề *
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>
              <label>
                Phiên bản
                <input
                  value={form.version}
                  onChange={(e) =>
                    setForm({ ...form, version: e.target.value })
                  }
                />
              </label>
              <label>
                Trạng thái
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {POLICY_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ngày hiệu lực
                <input
                  type="date"
                  value={form.effective_from}
                  onChange={(e) =>
                    setForm({ ...form, effective_from: e.target.value })
                  }
                />
              </label>
              <label>
                Hết hiệu lực
                <input
                  type="date"
                  value={form.effective_to}
                  onChange={(e) =>
                    setForm({ ...form, effective_to: e.target.value })
                  }
                />
              </label>
              <label>
                Phòng ban áp dụng
                <input
                  list="pol-depts"
                  value={form.applicable_departments}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      applicable_departments: e.target.value,
                    })
                  }
                />
                <datalist id="pol-depts">
                  <option value="Tất cả" />
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </label>
              <label>
                Người sở hữu
                <input
                  value={form.owner_name}
                  onChange={(e) =>
                    setForm({ ...form, owner_name: e.target.value })
                  }
                />
              </label>
              <label>
                Lần review gần nhất
                <input
                  type="date"
                  value={form.last_reviewed_at}
                  onChange={(e) =>
                    setForm({ ...form, last_reviewed_at: e.target.value })
                  }
                />
              </label>
              <label className="span2">
                Tóm tắt
                <textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) =>
                    setForm({ ...form, summary: e.target.value })
                  }
                />
              </label>
              <label className="span2">
                Nội dung (## tiêu đề mục)
                <textarea
                  rows={10}
                  value={form.sectionsText}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sectionsText: e.target.value,
                      content_text: e.target.value,
                    })
                  }
                  placeholder={'## Mục 1\nNội dung…'}
                />
              </label>
              <label className="span2">
                Văn bản OCR / dán thủ công
                <textarea
                  rows={4}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Khi AI không trích được chữ — dán nội dung tại đây rồi «Áp dụng văn bản»."
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>File đính kèm (R2)</legend>
            {attachments.length === 0 ? (
              <p className="muted">Chưa có tệp — dùng Upload & OCR hoặc Chỉ đính kèm.</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Tệp</th>
                      <th>Size</th>
                      <th>OCR</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {attachments.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <a
                            href={`/api/policies/attachments/${a.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {a.file_name}
                          </a>
                        </td>
                        <td className="mono">{formatBytes(a.size_bytes)}</td>
                        <td>
                          {a.ocr_status}
                          {a.ocr_error ? (
                            <div className="muted small">{a.ocr_error}</div>
                          ) : null}
                        </td>
                        <td className="actions-cell">
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={ocrBusy}
                            onClick={() =>
                              void runOcrOnAttachment(a.id, form).finally(() =>
                                setOcrBusy(false),
                              )
                            }
                          >
                            OCR lại
                          </button>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => void removeAttachment(a.id)}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </fieldset>

          <div className="form-actions">
            {pasteText.trim() ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => void applyPastedText()}
              >
                Áp dụng văn bản
              </button>
            ) : null}
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Xác nhận lưu'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setForm(null)
                setEditId(null)
                setAttachments([])
                setMsg(null)
                setPasteText('')
              }}
            >
              Đóng
            </button>
            {editId ? (
              <button
                type="button"
                className="btn ghost"
                disabled={saving}
                onClick={() => void removePolicy()}
              >
                Xóa văn bản
              </button>
            ) : null}
          </div>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="stack">
        <p className="page-lead muted">{description}</p>
        <div className="card empty">
          <p>Đang tải…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="stack">
        <p className="page-lead muted">{description}</p>
        <div className="card empty">
          <h2>Không tải được</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <p className="page-lead muted">{description}</p>
          <p className="table-meta muted">
            <strong>{items.length}</strong> bản ghi
            {canEdit ? ' · Admin: thêm / Upload & OCR' : ' · Chỉ xem'}
          </p>
        </div>
        {canEdit ? (
          <button type="button" className="btn primary" onClick={openCreate}>
            + Thêm chính sách
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="card empty">
          <h2>{title}</h2>
          <p>Không có dữ liệu</p>
        </div>
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tiêu đề</th>
                  <th>Loại</th>
                  <th>Phiên bản</th>
                  <th>Hiệu lực</th>
                  <th>Trạng thái</th>
                  <th>Phòng ban</th>
                  <th>Sở hữu</th>
                  <th>Review</th>
                  <th>File</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.code}</td>
                    <td className="cell-wrap">
                      <div>{r.title}</div>
                      {r.summary ? (
                        <div className="muted small">{r.summary}</div>
                      ) : null}
                    </td>
                    <td>{r.policy_type ?? '—'}</td>
                    <td>{r.version ?? '—'}</td>
                    <td className="mono">
                      {r.effective_from ?? '—'}
                      {r.effective_to ? ` → ${r.effective_to}` : ''}
                    </td>
                    <td>{policyStatusLabel(r.status)}</td>
                    <td className="cell-wrap">
                      {departmentsDisplay(r.applicable_departments)}
                    </td>
                    <td>{r.owner_name ?? '—'}</td>
                    <td className="mono">{r.last_reviewed_at ?? '—'}</td>
                    <td>
                      {r.r2_key || r.file_name ? (
                        <a
                          href={`/api/policies/${r.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.file_name ?? 'Tải'}
                        </a>
                      ) : (
                        (r.attachment_count ?? 0)
                      )}
                    </td>
                    {canEdit ? (
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => void openEdit(r.id)}
                        >
                          Sửa
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
