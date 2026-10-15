import { useCallback, useEffect, useMemo, useState } from 'react'
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
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; items: EmployeeListItem[] }
  | { status: 'error'; message: string }

export function EmployeeProfilesPage() {
  const { user } = useAuth()
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
      })
    }
  }

  async function save(form: EmployeeForm) {
    setSaving(true)
    setErr(null)
    try {
      if (mode === 'create') {
        await fetchJson('/api/employees', {
          method: 'POST',
          body: JSON.stringify(form),
        })
      } else if (form.id) {
        const { id: _id, ...payload } = form
        await fetchJson(`/api/employees/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
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
                  ? 'Admin / Super Admin: thêm & sửa đầy đủ thông tin nhân sự.'
                  : 'Chỉ xem. Liên hệ HR để cập nhật hồ sơ.'}
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
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Họ tên</th>
                    <th>GT</th>
                    <th>Phòng ban</th>
                    <th>Chức danh</th>
                    <th>Cấp</th>
                    <th>QL trực tiếp</th>
                    <th>Vào làm</th>
                    <th>HĐ / HHĐ</th>
                    <th>TT</th>
                    {canEdit ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((emp) => (
                    <tr key={emp.id}>
                      <td className="mono">{emp.code}</td>
                      <td>
                        <div>{emp.full_name}</div>
                        <div className="muted small">
                          {emp.email ?? emp.phone ?? '—'}
                        </div>
                      </td>
                      <td>{emp.gender ?? '—'}</td>
                      <td>{emp.department}</td>
                      <td>{emp.title}</td>
                      <td className="mono">
                        {LEVEL_OPTIONS.find((l) => l.value === emp.level)
                          ?.label.split('—')[0]
                          ?.trim() ?? emp.level}
                      </td>
                      <td>{managerName(emp.manager_id)}</td>
                      <td>{emp.joined_on}</td>
                      <td>
                        <div>{emp.contract_type}</div>
                        <div className="muted small">
                          HHĐ: {emp.contract_end ?? 'Không thời hạn'}
                        </div>
                      </td>
                      <td>
                        {EMP_STATUS.find((s) => s.value === emp.status)?.label ??
                          emp.status}
                      </td>
                      {canEdit ? (
                        <td>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => void openEdit(emp)}
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
      )}
    </div>
  )
}
