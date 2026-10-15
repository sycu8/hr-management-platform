import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  COURSE_DELIVERY,
  COURSE_LEVELS,
  COURSE_STATUS,
  COURSE_TYPES,
} from '../../lib/hr-options'
import { courseStatusLabel } from '../../lib/learning'

type Course = {
  id: string
  code: string | null
  title: string
  course_type: string
  level: string | null
  hours: number
  delivery_mode: string | null
  audience: string | null
  mandatory: number
  skill: string | null
  provider: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
}

type Form = {
  code: string
  title: string
  course_type: string
  level: string
  hours: number
  delivery_mode: string
  audience: string
  skill: string
  provider: string
  mandatory: boolean
  status: string
  start_date: string
  end_date: string
  description: string
}

const emptyForm = (): Form => ({
  code: '',
  title: '',
  course_type: 'Nội bộ',
  level: 'Cơ bản',
  hours: 8,
  delivery_mode: 'Trực tiếp',
  audience: '',
  skill: '',
  provider: 'Phòng Nhân sự',
  mandatory: false,
  status: 'active',
  start_date: '',
  end_date: '',
  description: '',
})

export function CoursesPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchJson<{ items: Course[] }>('/api/lists/courses')
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
    const res = await fetchJson<{ course: Course }>(`/api/learning/courses/${id}`)
    const c = res.course
    setForm({
      code: c.code ?? '',
      title: c.title,
      course_type: c.course_type,
      level: c.level ?? 'Cơ bản',
      hours: c.hours ?? 0,
      delivery_mode: c.delivery_mode ?? 'Trực tiếp',
      audience: c.audience ?? '',
      skill: c.skill ?? '',
      provider: c.provider ?? '',
      mandatory: !!c.mandatory,
      status: c.status ?? 'active',
      start_date: c.start_date ?? '',
      end_date: c.end_date ?? '',
      description: c.description ?? '',
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setMsg(null)
    const payload = {
      code: form.code || null,
      title: form.title,
      course_type: form.course_type,
      level: form.level || null,
      hours: Number(form.hours) || 0,
      delivery_mode: form.delivery_mode || null,
      audience: form.audience || null,
      skill: form.skill || null,
      provider: form.provider || null,
      mandatory: form.mandatory,
      status: form.status as Form['status'],
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      description: form.description || null,
    }
    try {
      if (editId) {
        await fetchJson(`/api/learning/courses/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await fetchJson('/api/learning/courses', {
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
        <h2>{editId ? 'Sửa chương trình đào tạo' : 'Thêm khóa học'}</h2>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void save(e)}>
          <div className="form-grid">
            <label>
              Mã khóa
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="DT-001"
              />
            </label>
            <label>
              Tên khóa học *
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>
            <label>
              Loại *
              <select
                value={form.course_type}
                onChange={(e) =>
                  setForm({ ...form, course_type: e.target.value })
                }
              >
                {[...new Set([form.course_type, ...COURSE_TYPES])].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mức độ
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              >
                {[...new Set([form.level, ...COURSE_LEVELS])].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Thời lượng (giờ)
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.hours}
                onChange={(e) =>
                  setForm({ ...form, hours: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Hình thức
              <select
                value={form.delivery_mode}
                onChange={(e) =>
                  setForm({ ...form, delivery_mode: e.target.value })
                }
              >
                {[...new Set([form.delivery_mode, ...COURSE_DELIVERY])].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Đối tượng
              <input
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                placeholder="Toàn công ty / Quản lý / Kinh doanh…"
              />
            </label>
            <label>
              Kỹ năng / competency
              <input
                value={form.skill}
                onChange={(e) => setForm({ ...form, skill: e.target.value })}
              />
            </label>
            <label>
              Đơn vị tổ chức
              <input
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
              />
            </label>
            <label>
              Trạng thái
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {COURSE_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ngày bắt đầu
              <input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
              />
            </label>
            <label>
              Ngày kết thúc
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </label>
            <label>
              Bắt buộc
              <select
                value={form.mandatory ? '1' : '0'}
                onChange={(e) =>
                  setForm({ ...form, mandatory: e.target.value === '1' })
                }
              >
                <option value="0">Không</option>
                <option value="1">Có</option>
              </select>
            </label>
            <label className="span2">
              Mô tả
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
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
        <p>Đang tải chương trình đào tạo…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Chương trình đào tạo</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="table-head">
        <p className="page-lead muted">
          Danh mục khóa học nội bộ / bên ngoài / e-learning / workshop.
          {canEdit ? ' Admin / Super Admin được thêm và sửa.' : ''}
        </p>
        <p className="table-meta muted">
          <strong>{items.length}</strong> bản ghi
          {canEdit ? (
            <>
              {' · '}
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setEditId(null)
                  setForm(emptyForm())
                }}
              >
                + Thêm khóa học
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
                  <th>Mã</th>
                  <th>Tên khóa</th>
                  <th>Loại</th>
                  <th>Mức độ</th>
                  <th>Giờ</th>
                  <th>Hình thức</th>
                  <th>Đối tượng</th>
                  <th>Kỹ năng</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.code ?? '—'}</td>
                    <td>
                      {r.title}
                      {r.mandatory ? (
                        <>
                          {' '}
                          <span className="status-pill bad">Bắt buộc</span>
                        </>
                      ) : null}
                    </td>
                    <td>{r.course_type}</td>
                    <td>{r.level ?? '—'}</td>
                    <td className="mono">{r.hours}</td>
                    <td>{r.delivery_mode ?? '—'}</td>
                    <td>{r.audience ?? '—'}</td>
                    <td>{r.skill ?? '—'}</td>
                    <td>
                      <span className="status-pill info">
                        {courseStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="mono">
                      {r.start_date || r.end_date
                        ? `${r.start_date ?? '…'} → ${r.end_date ?? '…'}`
                        : '—'}
                    </td>
                    {canEdit ? (
                      <td>
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
