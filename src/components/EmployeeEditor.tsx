import { useMemo, useState } from 'react'
import {
  CONTRACT_TYPES,
  DEPARTMENTS,
  EMP_STATUS,
  GENDERS,
  LEVEL_OPTIONS,
} from '../lib/hr-options'
import { vnd } from '../lib/format'

export type EmployeeForm = {
  id?: string
  code: string
  full_name: string
  email: string | null
  phone: string | null
  gender: string | null
  birth_date: string | null
  address: string | null
  department: string
  title: string
  level: number
  manager_id: string | null
  base_salary?: number
  dependents: number
  status: 'active' | 'left'
  joined_on: string
  left_on: string | null
  contract_type: string
  contract_start: string | null
  contract_end: string | null
  skills: string[]
}

export type ManagerOption = { id: string; code: string; full_name: string }

const emptyForm = (): EmployeeForm => ({
  code: '',
  full_name: '',
  email: '',
  phone: '',
  gender: 'Nam',
  birth_date: null,
  address: null,
  department: DEPARTMENTS[1] ?? 'Nhân sự',
  title: '',
  level: 0,
  manager_id: null,
  base_salary: 0,
  dependents: 0,
  status: 'active',
  joined_on: new Date().toISOString().slice(0, 10),
  left_on: null,
  contract_type: CONTRACT_TYPES[4] ?? 'Không xác định thời hạn',
  contract_start: null,
  contract_end: null,
  skills: [],
})

export function EmployeeEditor({
  initial,
  managers,
  mode,
  saving,
  error,
  onCancel,
  onSave,
}: {
  initial?: Partial<EmployeeForm> | null
  managers: ManagerOption[]
  mode: 'create' | 'edit'
  saving: boolean
  error: string | null
  onCancel: () => void
  onSave: (form: EmployeeForm) => Promise<void>
}) {
  const [form, setForm] = useState<EmployeeForm>(() => ({
    ...emptyForm(),
    ...initial,
    skills: initial?.skills ?? [],
    email: initial?.email ?? '',
  }))
  const [skillDraft, setSkillDraft] = useState('')

  const title = useMemo(
    () =>
      mode === 'create'
        ? 'Thêm nhân viên mới'
        : `Sửa hồ sơ — ${form.code || form.full_name}`,
    [mode, form.code, form.full_name],
  )

  function set<K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await onSave({
      ...form,
      email: form.email?.trim() ? form.email.trim() : null,
      phone: form.phone?.trim() ? form.phone.trim() : null,
      gender: form.gender?.trim() ? form.gender.trim() : null,
      address: form.address?.trim() ? form.address.trim() : null,
      birth_date: form.birth_date || null,
      left_on: form.status === 'left' ? form.left_on || null : null,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      manager_id: form.manager_id || null,
    })
  }

  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="muted">
        Hồ sơ theo chuẩn HR: thông tin cá nhân, công việc, hợp đồng, đãi ngộ cơ
        bản. Chỉ Admin / Super Admin được lưu.
      </p>
      {error ? <p className="warn-text">{error}</p> : null}

      <form className="hr-form" onSubmit={(e) => void submit(e)}>
        <fieldset>
          <legend>1. Thông tin cá nhân</legend>
          <div className="form-grid">
            <label>
              Mã nhân viên *
              <input
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                required
                disabled={mode === 'edit'}
                placeholder="NV033"
              />
            </label>
            <label>
              Họ và tên *
              <input
                value={form.full_name}
                onChange={(e) => set('full_name', e.target.value)}
                required
              />
            </label>
            <label>
              Giới tính
              <select
                value={form.gender ?? ''}
                onChange={(e) => set('gender', e.target.value || null)}
              >
                <option value="">—</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ngày sinh
              <input
                type="date"
                value={form.birth_date ?? ''}
                onChange={(e) => set('birth_date', e.target.value || null)}
              />
            </label>
            <label>
              Email công ty
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
              />
            </label>
            <label>
              Số điện thoại
              <input
                value={form.phone ?? ''}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="0901 234 567"
              />
            </label>
            <label className="span2">
              Địa chỉ thường trú / liên hệ
              <input
                value={form.address ?? ''}
                onChange={(e) => set('address', e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>2. Công việc & tổ chức</legend>
          <div className="form-grid">
            <label>
              Phòng ban *
              <select
                value={form.department}
                onChange={(e) => set('department', e.target.value)}
                required
              >
                {[...new Set([form.department, ...DEPARTMENTS])].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chức danh *
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                required
              />
            </label>
            <label>
              Cấp bậc (band)
              <select
                value={form.level}
                onChange={(e) => set('level', Number(e.target.value))}
              >
                {LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quản lý trực tiếp
              <select
                value={form.manager_id ?? ''}
                onChange={(e) => set('manager_id', e.target.value || null)}
              >
                <option value="">— Không có / CEO —</option>
                {managers
                  .filter((m) => m.id !== form.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {m.full_name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Ngày vào làm *
              <input
                type="date"
                value={form.joined_on}
                onChange={(e) => set('joined_on', e.target.value)}
                required
              />
            </label>
            <label>
              Trạng thái
              <select
                value={form.status}
                onChange={(e) =>
                  set('status', e.target.value as 'active' | 'left')
                }
              >
                {EMP_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {form.status === 'left' ? (
              <label>
                Ngày nghỉ việc
                <input
                  type="date"
                  value={form.left_on ?? ''}
                  onChange={(e) => set('left_on', e.target.value || null)}
                />
              </label>
            ) : null}
          </div>
        </fieldset>

        <fieldset>
          <legend>3. Hợp đồng lao động</legend>
          <div className="form-grid">
            <label>
              Loại hợp đồng *
              <select
                value={form.contract_type}
                onChange={(e) => set('contract_type', e.target.value)}
                required
              >
                {[...new Set([form.contract_type, ...CONTRACT_TYPES])].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Ngày bắt đầu HĐ
              <input
                type="date"
                value={form.contract_start ?? ''}
                onChange={(e) => set('contract_start', e.target.value || null)}
              />
            </label>
            <label>
              Ngày hết hạn HĐ
              <input
                type="date"
                value={form.contract_end ?? ''}
                onChange={(e) => set('contract_end', e.target.value || null)}
              />
            </label>
            <p className="muted span2">
              HĐ không thời hạn: để trống ngày hết hạn. Thử việc / HĐ xác định thời
              hạn: bắt buộc có ngày kết thúc để hệ thống cảnh báo.
            </p>
          </div>
        </fieldset>

        <fieldset>
          <legend>4. Đãi ngộ & kỹ năng (HR)</legend>
          <div className="form-grid">
            <label>
              Lương cơ bản (₫/tháng)
              <input
                type="number"
                min={0}
                step={100000}
                value={form.base_salary ?? 0}
                onChange={(e) => set('base_salary', Number(e.target.value) || 0)}
              />
              <span className="field-hint">
                Hiện tại: {vnd(form.base_salary ?? 0)}
              </span>
            </label>
            <label>
              Số người phụ thuộc (PIT)
              <input
                type="number"
                min={0}
                max={20}
                value={form.dependents}
                onChange={(e) => set('dependents', Number(e.target.value) || 0)}
              />
            </label>
            <label className="span2">
              Kỹ năng (thêm rồi Enter)
              <div className="skill-row">
                <input
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    const t = skillDraft.trim()
                    if (!t || form.skills.includes(t)) return
                    set('skills', [...form.skills, t])
                    setSkillDraft('')
                  }}
                  placeholder="VD: Luật lao động"
                />
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    const t = skillDraft.trim()
                    if (!t || form.skills.includes(t)) return
                    set('skills', [...form.skills, t])
                    setSkillDraft('')
                  }}
                >
                  Thêm
                </button>
              </div>
              <div className="skill-chips">
                {form.skills.length === 0 ? (
                  <span className="muted">Chưa có kỹ năng</span>
                ) : (
                  form.skills.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="chip"
                      onClick={() =>
                        set(
                          'skills',
                          form.skills.filter((x) => x !== s),
                        )
                      }
                      title="Xóa"
                    >
                      {s} ×
                    </button>
                  ))
                )}
              </div>
            </label>
          </div>
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'Đang lưu…' : mode === 'create' ? 'Tạo hồ sơ' : 'Lưu thay đổi'}
          </button>
          <button type="button" className="btn ghost" onClick={onCancel}>
            Hủy
          </button>
        </div>
      </form>
    </div>
  )
}
