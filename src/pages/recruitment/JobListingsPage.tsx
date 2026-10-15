import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { DEPARTMENTS } from '../../lib/hr-options'

type Job = {
  id: string
  title: string
  department: string
  headcount: number
  status: string
  posted_on: string | null
  deadline: string | null
  location: string | null
  salary_display: string | null
  level: string | null
  summary: string | null
  duties?: string[]
  requirements?: string[]
  benefits?: string[]
}

const emptyJob = (): Partial<Job> & {
  dutiesText: string
  requirementsText: string
  benefitsText: string
} => ({
  title: '',
  department: 'Kỹ thuật',
  headcount: 1,
  status: 'draft',
  location: 'Hà Nội',
  salary_display: '',
  level: 'Chuyên viên',
  summary: '',
  deadline: '',
  dutiesText: '',
  requirementsText: '',
  benefitsText: '',
})

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function JobListingsPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ReturnType<typeof emptyJob> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchJson<{ items: Job[] }>('/api/lists/jobs')
      .then((r) => {
        setItems(r.items ?? [])
        setError(null)
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Không tải được'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function openEdit(id: string) {
    setMsg(null)
    setEditId(id)
    const res = await fetchJson<{ job: Job }>(`/api/recruitment/jobs/${id}`)
    const j = res.job
    setForm({
      ...j,
      dutiesText: (j.duties ?? []).join('\n'),
      requirementsText: (j.requirements ?? []).join('\n'),
      benefitsText: (j.benefits ?? []).join('\n'),
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setMsg(null)
    const payload = {
      title: form.title,
      department: form.department,
      headcount: Number(form.headcount) || 1,
      level: form.level || null,
      location: form.location || null,
      salary_display: form.salary_display || null,
      status: form.status as 'draft' | 'open' | 'closed',
      deadline: form.deadline || null,
      summary: form.summary || null,
      duties: lines(form.dutiesText),
      requirements: lines(form.requirementsText),
      benefits: lines(form.benefitsText),
      posted_on:
        form.status === 'open'
          ? form.posted_on || new Date().toISOString().slice(0, 10)
          : form.posted_on || null,
    }
    try {
      if (editId) {
        await fetchJson(`/api/recruitment/jobs/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await fetchJson('/api/recruitment/jobs', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      setForm(null)
      setEditId(null)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (form) {
    return (
      <div className="card">
        <h2>{editId ? 'Sửa tin tuyển dụng / JD' : 'Đăng tin tuyển dụng mới'}</h2>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void save(e)}>
          <div className="form-grid">
            <label>
              Vị trí *
              <input
                value={form.title ?? ''}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>
            <label>
              Phòng ban *
              <select
                value={form.department ?? ''}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              >
                {[...new Set([form.department ?? '', ...DEPARTMENTS])].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Số lượng
              <input
                type="number"
                min={1}
                value={form.headcount ?? 1}
                onChange={(e) =>
                  setForm({ ...form, headcount: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Cấp bậc
              <input
                value={form.level ?? ''}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              />
            </label>
            <label>
              Địa điểm
              <input
                value={form.location ?? ''}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
            <label>
              Mức lương (hiển thị)
              <input
                value={form.salary_display ?? ''}
                onChange={(e) =>
                  setForm({ ...form, salary_display: e.target.value })
                }
                placeholder="18 – 28 triệu"
              />
            </label>
            <label>
              Trạng thái
              <select
                value={form.status ?? 'draft'}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Nháp</option>
                <option value="open">Đang tuyển</option>
                <option value="closed">Đã đóng</option>
              </select>
            </label>
            <label>
              Hạn nộp HS
              <input
                type="date"
                value={form.deadline ?? ''}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </label>
            <label className="span2">
              Tóm tắt JD
              <textarea
                rows={3}
                value={form.summary ?? ''}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            </label>
            <label className="span2">
              Trách nhiệm (mỗi dòng 1 mục)
              <textarea
                rows={4}
                value={form.dutiesText}
                onChange={(e) => setForm({ ...form, dutiesText: e.target.value })}
              />
            </label>
            <label className="span2">
              Yêu cầu
              <textarea
                rows={4}
                value={form.requirementsText}
                onChange={(e) =>
                  setForm({ ...form, requirementsText: e.target.value })
                }
              />
            </label>
            <label className="span2">
              Phúc lợi
              <textarea
                rows={3}
                value={form.benefitsText}
                onChange={(e) =>
                  setForm({ ...form, benefitsText: e.target.value })
                }
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
              onClick={() => {
                setForm(null)
                setEditId(null)
              }}
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
        <h2>Đăng tin & JD</h2>
        <p>Đang tải…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Đăng tin & JD</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div>
          <h2>Đăng tin & JD ({items.length})</h2>
          <p className="muted">
            {canEdit
              ? 'Admin / Super Admin: bổ sung / sửa mô tả vị trí tuyển dụng.'
              : 'Chỉ xem danh sách tin tuyển dụng.'}
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setEditId(null)
              setForm(emptyJob())
            }}
          >
            + Đăng tin
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p>Không có dữ liệu</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Vị trí</th>
                <th>Phòng ban</th>
                <th>SL</th>
                <th>TT</th>
                <th>Đăng</th>
                <th>Hạn</th>
                <th>Địa điểm</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((j) => (
                <tr key={j.id}>
                  <td>
                    <div>{j.title}</div>
                    <div className="muted small">{j.salary_display ?? '—'}</div>
                  </td>
                  <td>{j.department}</td>
                  <td className="mono">{j.headcount}</td>
                  <td>{j.status}</td>
                  <td>{j.posted_on ?? '—'}</td>
                  <td>{j.deadline ?? '—'}</td>
                  <td>{j.location ?? '—'}</td>
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => void openEdit(j.id)}
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
      )}
    </div>
  )
}
