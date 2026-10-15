import { DataTablePage } from '../../components/DataTablePage'

type Quota = {
  id: string
  year: number
  days: number
  reason: string
  employee_name: string
  employee_code: string
}

export function LeaveQuotaPage() {
  return (
    <DataTablePage<Quota>
      title="Hạn mức nghỉ phép"
      endpoint="/api/lists/leave-quotas?year=2026"
      columns={[
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'year', header: 'Năm', render: (r) => r.year, className: 'mono' },
        { key: 'days', header: 'Ngày cộng thêm', render: (r) => r.days, className: 'mono' },
        { key: 'reason', header: 'Lý do', render: (r) => r.reason },
      ]}
    />
  )
}
