import { DataTablePage } from '../../components/DataTablePage'

type Event = {
  id: string
  event_date: string
  event_type: string
  detail: string | null
  employee_name: string
  employee_code: string
}

export function WorkHistoryPage() {
  return (
    <DataTablePage<Event>
      title="Lịch sử công việc"
      endpoint="/api/lists/employment-events"
      columns={[
        { key: 'event_date', header: 'Ngày', render: (r) => r.event_date },
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'event_type', header: 'Loại', render: (r) => r.event_type },
        { key: 'detail', header: 'Chi tiết', render: (r) => r.detail ?? '—' },
      ]}
    />
  )
}
