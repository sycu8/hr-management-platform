import { useMemo, useState } from 'react'
import { DataTablePage } from '../../components/DataTablePage'

type Punch = {
  id: string
  employee_code: string
  employee_name: string
  work_date: string
  punch_in: string | null
  punch_out: string | null
  source: string
}

function currentYm() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function AttendancePage() {
  const [month, setMonth] = useState(currentYm)
  const endpoint = useMemo(
    () => `/api/lists/attendance?month=${encodeURIComponent(month)}`,
    [month],
  )

  return (
    <div className="stack">
      <div className="card toolbar">
        <label>
          Tháng
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>
      <DataTablePage<Punch>
        key={month}
        title="Chấm công"
        description={`Bảng chấm công tháng ${month} — giờ vào / ra theo nhân viên.`}
        endpoint={endpoint}
        columns={[
          {
            key: 'work_date',
            header: 'Ngày',
            render: (r) => r.work_date,
            className: 'mono',
          },
          {
            key: 'employee_code',
            header: 'Mã',
            render: (r) => r.employee_code,
            className: 'mono',
          },
          {
            key: 'employee_name',
            header: 'Nhân viên',
            render: (r) => r.employee_name,
          },
          {
            key: 'punch_in',
            header: 'Vào',
            render: (r) => r.punch_in ?? '—',
            className: 'mono',
          },
          {
            key: 'punch_out',
            header: 'Ra',
            render: (r) => r.punch_out ?? '—',
            className: 'mono',
          },
          {
            key: 'source',
            header: 'Nguồn',
            render: (r) => (
              <span className="status-pill info">{r.source}</span>
            ),
          },
        ]}
      />
    </div>
  )
}
