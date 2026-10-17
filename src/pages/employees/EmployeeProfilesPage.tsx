import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  EmployeeEditor,
  type EmployeeForm,
  type ManagerOption,
} from '../../components/EmployeeEditor'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { EMP_STATUS, LEVEL_OPTIONS } from '../../lib/hr-options'

type EmployeeListItem = {
  id: string
  code: string
  full_name: string
  email: string | null
  phone: string | null
  gender: string | null
  department: string
  title: string
  level: number
  status: string
  manager_id: string | null
  joined_on: string
  contract_type: string
  contract_end: string | null
  has_photo: boolean
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; items: EmployeeListItem[] }
  | { status: 'error'; message: string }

function photoUrl(id: string, hasPhoto: boolean) {
  return hasPhoto ? `/api/employees/${id}/photo` : null
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

export function EmployeeProfilesPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const canEdit = !!user?.canEditData
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [filter, setFilter] = useState<'active' | 'all' | 'left'>('active')
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<'idle' | 'create' | 'edit'>('idle')
  const [draft, setDraft] = useState<Partial<EmployeeForm> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setState({ status: 'loading' })
    const status = filter === 'all' ? 'all' : filter
    fetchJson<{ items: EmployeeListItem[] }>(
      `/api/employees?status=${status}&limit=200`,
    )
      .then((res) => setState({ status: 'ok', items: res.items }))
      .catch((e: unknown) =>
        setState({
          status: 'error',
          message: e instanceof Error ? e.message : 'Không tải được danh sách',
        }),
      )
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!highlightId || state.status !== 'ok') return
    const el = document.getElementById(`emp-card-${highlightId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('is-highlight')
    const t = window.setTimeout(() => el.classList.remove('is-highlight'), 2500)
    return () => window.clearTimeout(t)
  }, [highlightId, state])

  const managers: ManagerOption[] = useMemo(() => {
    if (state.status !== 'ok') return []
    return state.items
      .filter((e) => e.status === 'active')
      .map((e) => ({ id: e.id, code: e.code, full_name: e.full_name }))
  }, [state])

  const managerName = useMemo(() => {
    const map = new Map(managers.map((m) => [m.id, `${m.code} ${m.full_name}`]))
    return (id: string | null) => (id ? (map.get(id) ?? id) : '—')
  }, [managers])

  const visible = useMemo(() => {
    if (state.status !== 'ok') return []
    const needle = q.trim().toLowerCase()
    if (!needle) return state.items
    return state.items.filter((e) =>
      [e.code, e.full_name, e.department, e.title, e.email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [state, q])

  async function openEdit(row: EmployeeListItem) {
    setErr(null)
    setMode('edit')
    try {
      const detail = await fetchJson<{ employee: EmployeeForm }>(
        `/api/employees/${row.id}`,
      )
      setDraft({ ...detail.employee, id: row.id })
    } catch {
      setDraft({
        id: row.id,
        code: row.code,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        gender: row.gender,
        department: row.department,
        title: row.title,
        level: row.level,
        manager_id: row.manager_id,
        status: row.status === 'left' ? 'left' : 'active',
        joined_on: row.joined_on,
        contract_type: row.contract_type,
        contract_end: row.contract_end,
        dependents: 0,
        skills: [],
        birth_date: null,
        address: null,
        left_on: null,
        contract_start: null,
        has_photo: row.has_photo,
      })
    }
  }

  async function save(form: EmployeeForm) {
    setSaving(true)
    setErr(null)
    try {
      const {
        id: formId,
        pendingPhotoFile,
        has_photo: _hasPhoto,
        ...fields
      } = form
      if (mode === 'create') {
        const created = await fetchJson<{ id: string }>('/api/employees', {
          method: 'POST',
          body: JSON.stringify(fields),
        })
        if (pendingPhotoFile && created.id) {
          const body = new FormData()
          body.append('file', pendingPhotoFile)
          const r = await fetch(`/api/employees/${created.id}/photo`, {
            method: 'POST',
            body,
            credentials: 'same-origin',
          })
          if (!r.ok) {
            const t = await r.text()
            throw new Error(t || 'Không tải được ảnh')
          }
        }
      } else if (formId) {
        await fetchJson(`/api/employees/${formId}`, {
          method: 'PATCH',
          body: JSON.stringify(fields),
        })
        if (pendingPhotoFile) {
          const body = new FormData()
          body.append('file', pendingPhotoFile)
          const r = await fetch(`/api/employees/${formId}/photo`, {
            method: 'POST',
            body,
            credentials: 'same-origin',
          })
          if (!r.ok) {
            const t = await r.text()
            throw new Error(t || 'Không tải được ảnh')
          }
        }
      }
      setMode('idle')
      setDraft(null)
      load()
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (state.status === 'loading' && mode === 'idle') {
    return <div className="card empty">Đang tải hồ sơ nhân viên…</div>
  }

  if (state.status === 'error' && mode === 'idle') {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{state.message}</p>
      </div>
    )
  }

  return (
    <div className="stack">
      {mode !== 'idle' ? (
        <EmployeeEditor
          mode={mode}
          initial={draft}
          managers={managers}
          saving={saving}
          error={err}
          onCancel={() => {
            setMode('idle')
            setDraft(null)
            setErr(null)
          }}
          onSave={save}
        />
      ) : (
        <div className="card">
          <div className="toolbar">
            <div>
              <h2>Hồ sơ cá nhân ({visible.length})</h2>
              <p className="muted">
                {canEdit
                  ? 'Hồ sơ kèm ảnh. Admin / Super Admin: thêm, sửa và tải ảnh chân dung.'
                  : 'Xem dạng card — thông tin và ảnh nhân viên trong một khung.'}
              </p>
            </div>
            {canEdit ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setDraft(null)
                  setMode('create')
                  setErr(null)
                }}
              >
                + Thêm nhân viên
              </button>
            ) : null}
          </div>

          <div className="toolbar filters">
            <input
              className="search"
              placeholder="Tìm mã, tên, phòng ban…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as 'active' | 'all' | 'left')
              }
            >
              <option value="active">Đang làm việc</option>
              <option value="left">Đã nghỉ</option>
              <option value="all">Tất cả</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <p>Không có dữ liệu</p>
          ) : (
            <div className="emp-card-grid">
              {visible.map((emp) => {
                const src = photoUrl(emp.id, emp.has_photo)
                const levelLabel =
                  LEVEL_OPTIONS.find((l) => l.value === emp.level)
                    ?.label.split('—')[0]
                    ?.trim() ?? String(emp.level)
                const statusLabel =
                  EMP_STATUS.find((s) => s.value === emp.status)?.label ??
                  emp.status
                return (
                  <article
                    key={emp.id}
                    id={`emp-card-${emp.id}`}
                    className="emp-profile-card"
                  >
                    <div className="emp-profile-card__media">
                      {src ? (
                        <img
                          src={src}
                          alt=""
                          className="emp-profile-card__photo"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="emp-profile-card__placeholder"
                          aria-hidden
                        >
                          {initials(emp.full_name)}
                        </div>
                      )}
                      <span
                        className={`emp-profile-card__status emp-profile-card__status--${emp.status}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="emp-profile-card__body">
                      <div className="emp-profile-card__code mono">
                        {emp.code}
                      </div>
                      <h3 className="emp-profile-card__name">{emp.full_name}</h3>
                      <p className="emp-profile-card__title">
                        {emp.title}
                        <span className="muted"> · {levelLabel}</span>
                      </p>
                      <dl className="emp-profile-card__meta">
                        <div>
                          <dt>Phòng ban</dt>
                          <dd>{emp.department}</dd>
                        </div>
                        <div>
                          <dt>QL trực tiếp</dt>
                          <dd>{managerName(emp.manager_id)}</dd>
                        </div>
                        <div>
                          <dt>Vào làm</dt>
                          <dd>{emp.joined_on}</dd>
                        </div>
                        <div>
                          <dt>Hợp đồng</dt>
                          <dd>
                            {emp.contract_type}
                            <span className="muted small">
                              {' '}
                              · HHĐ {emp.contract_end ?? 'KTH'}
                            </span>
                          </dd>
                        </div>
                        <div className="emp-profile-card__contact">
                          <dt>Liên hệ</dt>
                          <dd>
                            {emp.email ?? emp.phone ?? '—'}
                            {emp.gender ? (
                              <span className="muted small">
                                {' '}
                                · {emp.gender}
                              </span>
                            ) : null}
                          </dd>
                        </div>
                      </dl>
                      {canEdit ? (
                        <div className="emp-profile-card__actions">
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => void openEdit(emp)}
                          >
                            Sửa hồ sơ / ảnh
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
