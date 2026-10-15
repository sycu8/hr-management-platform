import { DataTablePage } from '../../components/DataTablePage'

type Feedback = {
  id: string
  period: string
  employee_name: string
  employee_code: string
  scores_json: string
}

function scoreSummary(json: string): string {
  try {
    const s = JSON.parse(json) as Record<string, number>
    const parts = Object.entries(s).map(([k, v]) => `${k}: ${v}`)
    return parts.length ? parts.join(' · ') : '—'
  } catch {
    return '—'
  }
}

export function Review360Page() {
  return (
    <DataTablePage<Feedback>
      title="Đánh giá 360 độ"
      endpoint="/api/lists/feedback-360"
      columns={[
        { key: 'period', header: 'Kỳ', render: (r) => r.period },
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'scores', header: 'Điểm', render: (r) => scoreSummary(r.scores_json) },
      ]}
    />
  )
}
