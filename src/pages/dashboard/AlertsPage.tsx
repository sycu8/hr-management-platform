import { DataTablePage } from '../../components/DataTablePage'

type Leave = {
  id: string
  employee_name: string
  employee_code: string
  leave_type: string
  start_date: string
  end_date: string
  status: string
}

export function AlertsPage() {
  return (
    <DataTablePage<Leave>
      title="Cảnh báo & nhắc việc"
      endpoint="/api/lists/leave-requests"
      columns={[
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'leave_type', header: 'Loại', render: (r) => r.leave_type },
        { key: 'start_date', header: 'Từ', render: (r) => r.start_date },
        { key: 'end_date', header: 'Đến', render: (r) => r.end_date },
        { key: 'status', header: 'TT', render: (r) => r.status },
      ]}
    />
  )
}
