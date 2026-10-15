import { DataTablePage } from '../../components/DataTablePage'

type Run = {
  id: string
  year_month: string
  status: string
  closed_at: string | null
  legal_review_status: string
}

export function PayrollPage() {
  return (
    <DataTablePage<Run>
      title="Bảng lương hàng tháng"
      description="Các kỳ lương đã chốt hoặc đang soạn thảo."
      endpoint="/api/payroll/runs"
      columns={[
        { key: 'year_month', header: 'Tháng', render: (r) => r.year_month },
        { key: 'status', header: 'TT', render: (r) => r.status },
        { key: 'legal_review_status', header: 'Pháp lý', render: (r) => r.legal_review_status },
        { key: 'closed_at', header: 'Đóng', render: (r) => r.closed_at?.slice(0, 10) ?? '—' },
      ]}
    />
  )
}
