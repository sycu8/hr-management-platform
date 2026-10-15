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

export function PresencePage() {
  return (
    <DataTablePage<Punch>
      title="Hiện diện"
      endpoint="/api/lists/attendance?month=2026-09"
      columns={[
        { key: 'work_date', header: 'Ngày', render: (r) => r.work_date },
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'punch_in', header: 'Vào', render: (r) => r.punch_in ?? '—' },
        { key: 'punch_out', header: 'Ra', render: (r) => r.punch_out ?? '—' },
      ]}
    />
  )
}
