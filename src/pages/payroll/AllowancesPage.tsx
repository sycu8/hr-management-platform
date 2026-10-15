import { DataTablePage } from '../../components/DataTablePage'
import { vnd } from '../../lib/format'

type Earning = {
  id: string
  year_month: string
  kind: string
  title: string
  amount: number
  employee_name: string | null
  employee_code: string | null
}

export function AllowancesPage() {
  return (
    <DataTablePage<Earning>
      title="Phụ cấp & thưởng"
      endpoint="/api/lists/earnings"
      columns={[
        { key: 'year_month', header: 'Tháng', render: (r) => r.year_month },
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code ?? '—', className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name ?? 'Chung' },
        { key: 'kind', header: 'Loại', render: (r) => r.kind },
        { key: 'title', header: 'Khoản', render: (r) => r.title },
        { key: 'amount', header: 'Số tiền', render: (r) => vnd(r.amount), className: 'mono' },
      ]}
    />
  )
}
