import { DataTablePage } from '../../components/DataTablePage'

type Objective = {
  id: string
  period: string
  objective: string
  employee_name: string
  employee_code: string
  key_results_json: string
}

function krSummary(json: string): string {
  try {
    const arr = JSON.parse(json) as Array<{ kr?: string; progress?: number }>
    if (!Array.isArray(arr) || arr.length === 0) return '—'
    const avg =
      arr.reduce(
        (s, x) => s + (typeof x.progress === 'number' ? x.progress : 0),
        0,
      ) / arr.length
    return `${arr.length} KR · ${Math.round(avg * 100)}%`
  } catch {
    return '—'
  }
}

export function OkrPage() {
  return (
    <DataTablePage<Objective>
      title="KPI / OKR"
      description="Mục tiêu và key results theo kỳ đánh giá."
      endpoint="/api/lists/objectives"
      columns={[
        { key: 'period', header: 'Kỳ', render: (r) => r.period, className: 'mono' },
        {
          key: 'employee_code',
          header: 'Mã',
          render: (r) => r.employee_code,
          className: 'mono',
        },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        {
          key: 'objective',
          header: 'Mục tiêu',
          render: (r) => r.objective,
          className: 'cell-wrap',
        },
        { key: 'kr', header: 'KR', render: (r) => krSummary(r.key_results_json) },
      ]}
    />
  )
}
