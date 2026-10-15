import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type Category = 'Quy định' | 'Quy trình' | 'Pháp lý'

type Section = { h: string; b: string }

type PolicyListItem = {
  id: string
  code: string
  title: string
  version: string | null
  policy_type: string | null
  effective_from: string | null
  effective_to: string | null
  status: string
  applicable_departments: string | null
  summary: string | null
  file_name: string | null
  r2_key: string | null
  owner_name: string | null
  attachment_count?: number
}

type Attachment = {
  id: string
  file_name: string
  content_type: string | null
  size_bytes: number
  r2_key: string
  ocr_status: string
  ocr_error: string | null
}

type PolicyDetail = PolicyListItem & {
  content_text: string | null
  last_reviewed_at: string | null
  body: { sections: Section[] }
}

type FormState = {
  code: string
  title: string
  version: string
  policy_type: string
  effective_from: string
  effective_to: string
  status: string
  applicable_departments: string
  summary: string
  owner_name: string
  last_reviewed_at: string
  content_text: string
  sectionsText: string
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
    version: '',
    policy_type: '',
    effective_from: '',
    effective_to: '',
    status: 'active',
    applicable_departments: '',
    summary: '',
    owner_name: '',
    last_reviewed_at: '',
    content_text: '',
    sectionsText: '',
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function PoliciesManager({
  category,
  title,
  description,
}: {
  category: Category
  title: string
  description: string
}) {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const fileRef = useRef<HTMLInputElement>(null)

  const [items, setItems] = useState<PolicyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [ocrBusy, setOcrBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

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
    setEditId(null)
    setAttachments([])
    setForm(emptyForm())
  }

  async function openEdit(id: string) {
    setMsg(null)
    setEditId(id)
    const res = await fetchJson<{
      policy: PolicyDetail
      attachments: Attachment[]
    }>(`/api/policies/${id}`)
    const p = res.policy
    setForm({
      code: p.code,
      title: p.title,
      version: p.version ?? '',
      policy_type: p.policy_type ?? '',
      effective_from: p.effective_from ?? '',
      effective_to: p.effective_to ?? '',
      status: p.status ?? 'active',
      applicable_departments: p.applicable_departments ?? '',
      summary: p.summary ?? '',
      owner_name: p.owner_name ?? '',
      last_reviewed_at: p.last_reviewed_at ?? '',
      content_text: p.content_text ?? '',
      sectionsText: sectionsToText(p.body?.sections ?? []),
    })
    setAttachments(res.attachments ?? [])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setMsg(null)
    try {
      const payload = {
        category,
        code: form.code.trim(),
        title: form.title.trim(),
        version: form.version.trim() || null,
        policy_type: form.policy_type.trim() || null,
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null,
        status: form.status,
        applicable_departments: form.applicable_departments.trim() || null,
        summary: form.summary.trim() || null,
        content_text: form.content_text.trim() || null,
        owner_name: form.owner_name.trim() || null,
        last_reviewed_at: form.last_reviewed_at || null,
        body_json: { sections: textToSections(form.sectionsText) },
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
      setMsg('Đã lưu.')
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  async function removePolicy() {
    if (!editId) return
    if (!window.confirm('Xóa văn bản và tệp trên R2?')) return
    setSaving(true)
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

  async function uploadFile(file: File) {
    if (!editId) {
      setMsg('Lưu văn bản trước khi upload R2.')
      return
    }
    setUploading(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/policies/${editId}/attachments`, {
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
      setAttachments((prev) => [data.attachment, ...prev])
      setMsg(`Đã lưu R2: ${data.attachment.r2_key}`)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Upload thất bại')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function runOcr(attachmentId: string) {
    setOcrBusy(attachmentId)
    setMsg(null)
    try {
      const res = await fetchJson<{
        method: string
        sections: Section[]
        policy: PolicyDetail | null
      }>(`/api/policies/attachments/${attachmentId}/ocr`, { method: 'POST' })
      if (res.policy && form) {
        setForm({
          ...form,
          summary: res.policy.summary ?? form.summary,
          content_text: res.policy.content_text ?? form.content_text,
          sectionsText: sectionsToText(
            res.policy.body?.sections ?? res.sections,
          ),
        })
      }
      if (editId) {
        const refreshed = await fetchJson<{
          attachments: Attachment[]
        }>(`/api/policies/${editId}`)
        setAttachments(refreshed.attachments ?? [])
      }
      setMsg(`OCR xong (${res.method}).`)
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'OCR thất bại')
    } finally {
      setOcrBusy(null)
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!window.confirm('Xóa tệp khỏi R2?')) return
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
          Binary lưu Cloudflare R2 binding <code>DOCUMENTS</code>. D1 chỉ giữ
          metadata (r2_key, filename, mime, size…).
        </p>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void save(e)}>
          <fieldset>
            <legend>Thông tin văn bản</legend>
            <div className="form-grid">
              <label>
                Mã *
                <input
                  className="mono"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
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
              <label className="span2">
                Tiêu đề *
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>
              <label>
                Loại
                <input
                  value={form.policy_type}
                  onChange={(e) =>
                    setForm({ ...form, policy_type: e.target.value })
                  }
                  placeholder="Nội quy / SOP / Luật…"
                />
              </label>
              <label>
                Trạng thái
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="draft">Nháp</option>
                  <option value="active">Đang hiệu lực</option>
                  <option value="expired">Hết hiệu lực</option>
                  <option value="archived">Lưu trữ</option>
                </select>
              </label>
              <label>
                Hiệu lực từ
                <input
                  type="date"
                  value={form.effective_from}
                  onChange={(e) =>
                    setForm({ ...form, effective_from: e.target.value })
                  }
                />
              </label>
              <label>
                Hiệu lực đến
                <input
                  type="date"
                  value={form.effective_to}
                  onChange={(e) =>
                    setForm({ ...form, effective_to: e.target.value })
                  }
                />
              </label>
              <label>
                Người phụ trách
                <input
                  value={form.owner_name}
                  onChange={(e) =>
                    setForm({ ...form, owner_name: e.target.value })
                  }
                />
              </label>
              <label>
                Rà soát gần nhất
                <input
                  type="date"
                  value={form.last_reviewed_at}
                  onChange={(e) =>
                    setForm({ ...form, last_reviewed_at: e.target.value })
                  }
                />
              </label>
              <label className="span2">
                Phòng ban áp dụng
                <input
                  value={form.applicable_departments}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      applicable_departments: e.target.value,
                    })
                  }
                  placeholder="Tất cả / Kỹ thuật, Nhân sự…"
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
                Nội dung (## tiêu đề mỗi mục)
                <textarea
                  rows={10}
                  value={form.sectionsText}
                  onChange={(e) =>
                    setForm({ ...form, sectionsText: e.target.value })
                  }
                />
              </label>
              <label className="span2">
                Văn bản OCR / raw
                <textarea
                  rows={4}
                  value={form.content_text}
                  onChange={(e) =>
                    setForm({ ...form, content_text: e.target.value })
                  }
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Tệp đính kèm (R2 DOCUMENTS)</legend>
            {!editId ? (
              <p className="muted">Lưu văn bản trước để upload.</p>
            ) : (
              <>
                <div className="form-actions">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.doc,.docx"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void uploadFile(f)
                    }}
                  />
                  {uploading ? (
                    <span className="muted">Đang tải lên R2…</span>
                  ) : null}
                </div>
                {attachments.length === 0 ? (
                  <p className="muted">Chưa có tệp.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Tệp</th>
                          <th>R2 key</th>
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
                            <td className="mono cell-wrap">{a.r2_key}</td>
                            <td className="mono">
                              {formatBytes(a.size_bytes)}
                            </td>
                            <td>
                              {a.ocr_status}
                              {a.ocr_error ? (
                                <div className="muted small">{a.ocr_error}</div>
                              ) : null}
                            </td>
                            <td className="actions-cell">
                              <button
                                type="button"
                                className="btn"
                                disabled={ocrBusy === a.id}
                                onClick={() => void runOcr(a.id)}
                              >
                                {ocrBusy === a.id ? 'OCR…' : 'OCR'}
                              </button>
                              <button
                                type="button"
                                className="btn"
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
              </>
            )}
          </fieldset>

          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setForm(null)
                setEditId(null)
                setAttachments([])
              }}
            >
              Đóng
            </button>
            {editId ? (
              <button
                type="button"
                className="btn"
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
      <div className="table-head">
        <p className="page-lead muted">{description}</p>
        <p className="table-meta muted">
          <strong>{items.length}</strong> bản ghi
          {canEdit ? (
            <>
              {' · '}
              <button
                type="button"
                className="btn primary"
                onClick={() => openCreate()}
              >
                Thêm văn bản
              </button>
            </>
          ) : null}
        </p>
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
                  <th>TT</th>
                  <th>Hiệu lực</th>
                  <th>Tóm tắt</th>
                  <th>R2</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.code}</td>
                    <td className="cell-wrap">{r.title}</td>
                    <td>{r.policy_type ?? '—'}</td>
                    <td>{r.status ?? '—'}</td>
                    <td className="mono">
                      {r.effective_from ?? '—'}
                      {r.effective_to ? ` → ${r.effective_to}` : ''}
                    </td>
                    <td className="cell-wrap">{r.summary ?? '—'}</td>
                    <td className="mono">
                      {r.attachment_count ?? (r.r2_key ? 1 : 0)}
                    </td>
                    {canEdit ? (
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn"
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
