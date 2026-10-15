import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type Candidate = {
  id: string
  job_id: string
  full_name: string
  job_title: string | null
  stage: string
  score: number | null
  source: string | null
  email: string | null
  phone: string | null
  interview_at: string | null
  note: string | null
  recruitment_note: string | null
  linkedin_url: string | null
  facebook_url: string | null
  cv_url: string | null
  cv_file_name: string | null
}

type JobOpt = { id: string; title: string }

const STAGES = [
  'new',
  'screen',
  'interview',
  'offer',
  'hired',
  'rejected',
  'Mới',
  'Sàng lọc',
  'Phỏng vấn',
  'Offer',
  'Nhận việc',
  'Loại',
]

export function CandidatesPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Candidate[]>([])
  const [jobs, setJobs] = useState<JobOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<Candidate> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ items: Candidate[] }>('/api/lists/candidates'),
      fetchJson<{ items: JobOpt[] }>('/api/lists/jobs'),
    ])
      .then(([c, j]) => {
        setItems(c.items ?? [])
        setJobs((j.items ?? []).map((x) => ({ id: x.id, title: x.title })))
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
    const res = await fetchJson<{ candidate: Candidate }>(
      `/api/recruitment/candidates/${id}`,
    )
    setEditing(res.candidate)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setMsg(null)
    try {
      const payload = {
        job_id: editing.job_id,
        full_name: editing.full_name,
        source: editing.source,
        stage: editing.stage,
        score: editing.score,
        email: editing.email,
        phone: editing.phone,
        interview_at: editing.interview_at,
        note: editing.note,
        recruitment_note: editing.recruitment_note,
        linkedin_url: editing.linkedin_url || null,
        facebook_url: editing.facebook_url || null,
        cv_url: editing.cv_url || null,
        cv_file_name: editing.cv_file_name,
      }
      if (editId) {
        await fetchJson(`/api/recruitment/candidates/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await fetchJson('/api/recruitment/candidates', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      setEditing(null)
      setEditId(null)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="card">
        <h2>{editId ? 'Sửa hồ sơ ứng viên' : 'Thêm ứng viên'}</h2>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void save(e)}>
          <fieldset>
            <legend>Thông tin ứng viên</legend>
            <div className="form-grid">
              <label>
                Họ tên *
                <input
                  value={editing.full_name ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, full_name: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Vị trí ứng tuyển *
                <select
                  value={editing.job_id ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, job_id: e.target.value })
                  }
                  required
                >
                  <option value="">— Chọn JD —</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vòng / giai đoạn
                <select
                  value={editing.stage ?? 'new'}
                  onChange={(e) =>
                    setEditing({ ...editing, stage: e.target.value })
                  }
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Điểm (0–10)
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={editing.score ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, score: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Nguồn
                <input
                  value={editing.source ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, source: e.target.value })
                  }
                  placeholder="LinkedIn / TopCV / Giới thiệu"
                />
              </label>
              <label>
                Lịch phỏng vấn
                <input
                  type="datetime-local"
                  value={
                    editing.interview_at
                      ? editing.interview_at.slice(0, 16)
                      : ''
                  }
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      interview_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={editing.email ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, email: e.target.value })
                  }
                />
              </label>
              <label>
                Điện thoại
                <input
                  value={editing.phone ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, phone: e.target.value })
                  }
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Nội dung tuyển dụng & hồ sơ đính kèm</legend>
            <div className="form-grid">
              <label className="span2">
                Nội dung / ghi chú tuyển dụng
                <textarea
                  rows={4}
                  value={editing.recruitment_note ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      recruitment_note: e.target.value,
                    })
                  }
                  placeholder="Đánh giá fit JD, mức lương kỳ vọng, điểm mạnh/yếu…"
                />
              </label>
              <label className="span2">
                Ghi chú nội bộ
                <textarea
                  rows={2}
                  value={editing.note ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, note: e.target.value })
                  }
                />
              </label>
              <label>
                Link CV (Drive / URL)
                <input
                  type="url"
                  value={editing.cv_url ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, cv_url: e.target.value })
                  }
                  placeholder="https://…"
                />
              </label>
              <label>
                Tên file CV
                <input
                  value={editing.cv_file_name ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, cv_file_name: e.target.value })
                  }
                  placeholder="CV_NguyenVanA.pdf"
                />
              </label>
              <label>
                LinkedIn
                <input
                  type="url"
                  value={editing.linkedin_url ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, linkedin_url: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/…"
                />
              </label>
              <label>
                Facebook
                <input
                  type="url"
                  value={editing.facebook_url ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, facebook_url: e.target.value })
                  }
                  placeholder="https://facebook.com/…"
                />
              </label>
            </div>
          </fieldset>

          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setEditing(null)
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
        <h2>Theo dõi ứng viên</h2>
        <p>Đang tải…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Theo dõi ứng viên</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div>
          <h2>Theo dõi ứng viên ({items.length})</h2>
          <p className="muted">
            Hồ sơ tuyển dụng, CV / LinkedIn / Facebook.
            {canEdit ? ' Admin / Super Admin được sửa.' : ''}
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setEditId(null)
              setEditing({
                full_name: '',
                job_id: jobs[0]?.id ?? '',
                stage: 'new',
                score: 0,
                source: '',
                recruitment_note: '',
              })
            }}
          >
            + Thêm ứng viên
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
                <th>Ứng viên</th>
                <th>Vị trí</th>
                <th>Vòng</th>
                <th>Điểm</th>
                <th>Nguồn</th>
                <th>Hồ sơ</th>
                <th>PV</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div>{c.full_name}</div>
                    <div className="muted small">{c.email ?? c.phone ?? '—'}</div>
                  </td>
                  <td>{c.job_title ?? '—'}</td>
                  <td>{c.stage}</td>
                  <td className="mono">{c.score ?? '—'}</td>
                  <td>{c.source ?? '—'}</td>
                  <td>
                    <div className="link-stack">
                      {c.cv_url ? (
                        <a href={c.cv_url} target="_blank" rel="noreferrer">
                          CV
                        </a>
                      ) : (
                        <span className="muted">
                          {c.cv_file_name ?? '—'}
                        </span>
                      )}
                      {c.linkedin_url ? (
                        <a href={c.linkedin_url} target="_blank" rel="noreferrer">
                          LinkedIn
                        </a>
                      ) : null}
                      {c.facebook_url ? (
                        <a href={c.facebook_url} target="_blank" rel="noreferrer">
                          FB
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    {c.interview_at
                      ? c.interview_at.slice(0, 16).replace('T', ' ')
                      : '—'}
                  </td>
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => void openEdit(c.id)}
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
