import { DataTablePage } from '../../components/DataTablePage'

type Leave = {
  id: string
  employee_name: string
  employee_code: string
  leave_type: string
  start_date: string
  end_date: string
  working_days: number
  status: string
}

export function TeamCalendarPage() {
  return (
    <DataTablePage<Leave>
      title="Lịch nghỉ team"
      endpoint="/api/lists/leave-requests"
      columns={[
        { key: 'start_date', header: 'Từ', render: (r) => r.start_date },
        { key: 'end_date', header: 'Đến', render: (r) => r.end_date },
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'leave_type', header: 'Loại', render: (r) => r.leave_type },
        { key: 'working_days', header: 'Ngày', render: (r) => r.working_days, className: 'mono' },
        { key: 'status', header: 'TT', render: (r) => r.status },
      ]}
    />
  )
}
