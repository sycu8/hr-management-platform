import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { certValidity } from '../../lib/learning'

type Cert = {
  id: string
  employee_id?: string
  course_id: string | null
  name: string
  cert_number: string | null
  issuer: string | null
  issued_on: string | null
  expires_on: string | null
  file_name: string | null
  file_url: string | null
  employee_name: string
  employee_code?: string
  course_title: string | null
}

type Emp = { id: string; code: string; full_name: string }
type CourseOpt = { id: string; title: string; code: string | null }

type Form = {
  id?: string
  employee_id: string
  course_id: string
  name: string
  cert_number: string
  issuer: string
  issued_on: string
  expires_on: string
  file_name: string
  file_url: string
}

export function CertificatesPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Cert[]>([])
  const [emps, setEmps] = useState<Emp[]>([])
  const [courses, setCourses] = useState<CourseOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ items: Cert[] }>('/api/lists/certificates'),
      fetchJson<{ items: Emp[] }>('/api/employees?status=active&limit=200'),
      fetchJson<{ items: CourseOpt[] }>('/api/lists/courses'),
    ])
      .then(([certs, e, c]) => {
        setItems(certs.items ?? [])
        setEmps(e.items ?? [])
        setCourses(c.items ?? [])
        setError(null)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Không tải được'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function openEdit(id: string) {
    setMsg(null)
    const res = await fetchJson<{ certificate: Cert }>(
      `/api/learning/certificates/${id}`,
    )
    const c = res.certificate
    setForm({
      id: c.id,
      employee_id: c.employee_id ?? '',
      course_id: c.course_id ?? '',
      name: c.name,
      cert_number: c.cert_number ?? '',
      issuer: c.issuer ?? '',
      issued_on: c.issued_on ?? '',
      expires_on: c.expires_on ?? '',
      file_name: c.file_name ?? '',
      file_url: c.file_url ?? '',
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setMsg(null)
    const payload = {
      employee_id: form.employee_id,
      course_id: form.course_id || null,
      name: form.name,
      cert_number: form.cert_number || null,
      issuer: form.issuer || null,
      issued_on: form.issued_on || null,
      expires_on: form.expires_on || null,
      file_name: form.file_name || null,
      file_url: form.file_url || null,
    }
    try {
      if (form.id) {
        await fetchJson(`/api/learning/certificates/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await fetchJson('/api/learning/certificates', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      setForm(null)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Xóa chứng chỉ này?')) return
    await fetchJson(`/api/learning/certificates/${id}`, { method: 'DELETE' })
    load()
  }

  if (form) {
    return (
      <div className="card">
        <h2>{form.id ? 'Sửa chứng chỉ' : 'Thêm chứng chỉ'}</h2>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void save(e)}>
          <div className="form-grid">
            <label>
              Nhân viên *
              <select
                value={form.employee_id}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
                required
              >
                <option value="">—</option>
                {emps.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.code} — {emp.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Khóa liên quan
              <select
                value={form.course_id}
                onChange={(e) =>
                  setForm({ ...form, course_id: e.target.value })
                }
              >
                <option value="">— Không gắn khóa —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} — ` : ''}
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tên chứng chỉ *
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              Số chứng chỉ
              <input
                value={form.cert_number}
                onChange={(e) =>
                  setForm({ ...form, cert_number: e.target.value })
                }
                placeholder="NB-BH-001"
              />
            </label>
            <label>
              Đơn vị cấp
              <input
                value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              />
            </label>
            <label>
              Ngày cấp
              <input
                type="date"
                value={form.issued_on}
                onChange={(e) =>
                  setForm({ ...form, issued_on: e.target.value })
                }
              />
            </label>
            <label>
              Ngày hết hạn
              <input
                type="date"
                value={form.expires_on}
                onChange={(e) =>
                  setForm({ ...form, expires_on: e.target.value })
                }
              />
            </label>
            <label>
              Tên file đính kèm
              <input
                value={form.file_name}
                onChange={(e) =>
                  setForm({ ...form, file_name: e.target.value })
                }
                placeholder="chung-chi.pdf"
              />
            </label>
            <label className="span2">
              Link file (Drive / URL)
              <input
                type="url"
                value={form.file_url}
                onChange={(e) =>
                  setForm({ ...form, file_url: e.target.value })
                }
                placeholder="https://…"
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setForm(null)}
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card empty">
        <p>Đang tải chứng chỉ…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Chứng chỉ nội bộ</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="table-head">
        <p className="page-lead muted">
          Chứng chỉ nội bộ và bên ngoài: số chứng chỉ, hạn và file đính kèm.
          {canEdit ? ' Admin / Super Admin được thêm / sửa / xóa.' : ''}
        </p>
        <p className="table-meta muted">
          <strong>{items.length}</strong> bản ghi
          {canEdit ? (
            <>
              {' · '}
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  setForm({
                    employee_id: '',
                    course_id: '',
                    name: '',
                    cert_number: '',
                    issuer: '',
                    issued_on: new Date().toISOString().slice(0, 10),
                    expires_on: '',
                    file_name: '',
                    file_url: '',
                  })
                }
              >
                + Thêm chứng chỉ
              </button>
            </>
          ) : null}
        </p>
      </div>
      {items.length === 0 ? (
        <div className="card empty">
          <p>Không có dữ liệu</p>
        </div>
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Chứng chỉ</th>
                  <th>Số CC</th>
                  <th>Khóa liên quan</th>
                  <th>Cấp bởi</th>
                  <th>Ngày cấp</th>
                  <th>Hết hạn</th>
                  <th>Tình trạng</th>
                  <th>File</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const st = certValidity(r.expires_on)
                  return (
                    <tr key={r.id}>
                      <td>
                        {r.employee_code ? (
                          <span className="mono">{r.employee_code}</span>
                        ) : null}{' '}
                        {r.employee_name}
                      </td>
                      <td>{r.name}</td>
                      <td className="mono">{r.cert_number ?? '—'}</td>
                      <td>{r.course_title ?? '—'}</td>
                      <td>{r.issuer ?? '—'}</td>
                      <td className="mono">{r.issued_on ?? '—'}</td>
                      <td className="mono">{r.expires_on ?? '—'}</td>
                      <td>
                        <span className={`status-pill ${st.tone}`}>
                          {st.label}
                        </span>
                      </td>
                      <td>
                        {r.file_url ? (
                          <a href={r.file_url} target="_blank" rel="noreferrer">
                            {r.file_name || 'Mở file'}
                          </a>
                        ) : (
                          (r.file_name ?? '—')
                        )}
                      </td>
                      {canEdit ? (
                        <td>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => void openEdit(r.id)}
                          >
                            Sửa
                          </button>{' '}
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => void remove(r.id)}
                          >
                            Xóa
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
