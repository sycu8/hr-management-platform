import { DataTablePage } from '../../components/DataTablePage'

type Rating = {
  id: string
  cycle_name: string | null
  employee_name: string
  employee_code: string
  self_score: number | null
  manager_score: number | null
  final_score: number | null
}

export function PerfHistoryPage() {
  return (
    <DataTablePage<Rating>
      title="Lịch sử hiệu suất"
      endpoint="/api/lists/ratings"
      columns={[
        { key: 'cycle_name', header: 'Chu kỳ', render: (r) => r.cycle_name ?? '—' },
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'self_score', header: 'Tự ĐG', render: (r) => r.self_score ?? '—', className: 'mono' },
        {
          key: 'manager_score',
          header: 'QL',
          render: (r) => r.manager_score ?? '—',
          className: 'mono',
        },
        { key: 'final_score', header: 'Cuối', render: (r) => r.final_score ?? '—', className: 'mono' },
      ]}
    />
  )
}
