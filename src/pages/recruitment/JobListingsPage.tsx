import { DataTablePage } from '../../components/DataTablePage'

type Job = {
  id: string
  title: string
  department: string
  headcount: number
  status: string
  posted_on: string | null
  deadline: string | null
  location: string | null
  salary_display: string | null
}

export function JobListingsPage() {
  return (
    <DataTablePage<Job>
      title="Đăng tin & JD"
      endpoint="/api/lists/jobs"
      columns={[
        { key: 'title', header: 'Vị trí', render: (r) => r.title },
        { key: 'department', header: 'Phòng ban', render: (r) => r.department },
        { key: 'headcount', header: 'SL', render: (r) => r.headcount, className: 'mono' },
        { key: 'status', header: 'Trạng thái', render: (r) => r.status },
        { key: 'posted_on', header: 'Đăng', render: (r) => r.posted_on ?? '—' },
        { key: 'deadline', header: 'Hạn', render: (r) => r.deadline ?? '—' },
        { key: 'location', header: 'Địa điểm', render: (r) => r.location ?? '—' },
      ]}
    />
  )
}
