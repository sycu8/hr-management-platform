import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  EmployeeEditor,
  type EmployeeForm,
  type ManagerOption,
} from '../../components/EmployeeEditor'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { vnd } from '../../lib/format'

type Profile = {
  id: string
  code: string
  full_name: string
  department: string
  title: string
  contract_type: string
  contract_start: string | null
  contract_end: string | null
  joined_on: string
  status: string
  manager_id: string | null
}

/**
 * Job / contract view — HR managers edit employment terms here.
 * Reuses the full employee editor focused on contract & org fields.
 */
export function JobProfilesPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Profile[]>([])
  const [managers, setManagers] = useState<ManagerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EmployeeForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ items: Profile[] }>('/api/lists/job-profiles'),
      fetchJson<{ items: ManagerOption[] }>('/api/employees?status=active&limit=200'),
    ])
      .then(([jobs, emps]) => {
        setItems(jobs.items ?? [])
        setManagers(
          (emps.items ?? []).map((e) => ({
            id: e.id,
            code: e.code,
            full_name: e.full_name,
          })),
        )
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

  const expiringSoon = useMemo(() => {
    const lim = new Date()
    lim.setDate(lim.getDate() + 90)
    const limStr = lim.toISOString().slice(0, 10)
    return items.filter(
      (p) => p.contract_end && p.contract_end <= limStr && p.status === 'active',
    ).length
  }, [items])

  async function openEdit(row: Profile) {
    setSaveErr(null)
    const detail = await fetchJson<{ employee: EmployeeForm }>(
      `/api/employees/${row.id}`,
    )
    setEditing({ ...detail.employee, id: row.id })
  }

  async function save(form: EmployeeForm) {
    if (!form.id) return
    setSaving(true)
    setSaveErr(null)
    try {
      const { id, ...payload } = form
      await fetchJson(`/api/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setEditing(null)
      load()
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <EmployeeEditor
        mode="edit"
        initial={editing}
        managers={managers}
        saving={saving}
        error={saveErr}
        onCancel={() => setEditing(null)}
        onSave={save}
      />
    )
  }

  if (loading) {
    return (
      <div className="card empty">
        <h2>Hồ sơ công việc</h2>
        <p>Đang tải…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card empty">
        <h2>Hồ sơ công việc</h2>
        <p>{error}</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="card empty">
        <h2>Hồ sơ công việc</h2>
        <p>Không có dữ liệu</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Hồ sơ công việc ({items.length})</h2>
      <p className="muted">
        Theo dõi HĐLĐ, ngày hết hạn và vị trí. {expiringSoon > 0
          ? `${expiringSoon} HĐ hết hạn trong 90 ngày — ưu tiên gia hạn.`
          : 'Không có HĐ sắp hết hạn trong 90 ngày.'}
        {canEdit ? ' Admin / Super Admin bấm Sửa để cập nhật.' : ''}
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Họ tên</th>
              <th>Phòng ban</th>
              <th>Chức danh</th>
              <th>Loại HĐ</th>
              <th>Bắt đầu HĐ</th>
              <th>Hết hạn HĐ</th>
              <th>Vào làm</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const soon =
                r.contract_end &&
                r.contract_end <=
                  new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)
              return (
                <tr key={r.id} className={soon ? 'row-warn' : undefined}>
                  <td className="mono">{r.code}</td>
                  <td>{r.full_name}</td>
                  <td>{r.department}</td>
                  <td>{r.title}</td>
                  <td>{r.contract_type}</td>
                  <td>{r.contract_start ?? '—'}</td>
                  <td>
                    {r.contract_end ?? 'Không thời hạn'}
                    {soon ? ' ⚠' : ''}
                  </td>
                  <td>{r.joined_on}</td>
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => void openEdit(r)}
                      >
                        Sửa
                      </button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <p className="muted small">
          Lương cơ bản chỉnh trong form Sửa (phần Đãi ngộ). Tham chiếu mẫu:{' '}
          {vnd(18000000)}.
        </p>
      ) : null}
    </div>
  )
}
