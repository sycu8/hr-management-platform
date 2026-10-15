import { DataTablePage } from '../../components/DataTablePage'

type Enrollment = {
  id: string
  employee_name: string
  employee_code: string
  course_title: string
  progress: number
  due_on: string | null
}

export function ProgressPage() {
  return (
    <DataTablePage<Enrollment>
      title="Tiến độ học"
      endpoint="/api/lists/enrollments"
      columns={[
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'course_title', header: 'Khóa học', render: (r) => r.course_title },
        {
          key: 'progress',
          header: 'Tiến độ',
          render: (r) => {
            const p = r.progress ?? 0
            const pct = p <= 1 ? Math.round(p * 100) : Math.round(p)
            return `${pct}%`
          },
          className: 'mono',
        },
        { key: 'due_on', header: 'Hạn', render: (r) => r.due_on ?? '—' },
      ]}
    />
  )
}
