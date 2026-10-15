import { DataTablePage } from '../../components/DataTablePage'

type Candidate = {
  id: string
  full_name: string
  job_title: string | null
  stage: string
  score: number | null
  source: string | null
  email: string | null
  interview_at: string | null
}

export function CandidatesPage() {
  return (
    <DataTablePage<Candidate>
      title="Theo dõi ứng viên"
      endpoint="/api/lists/candidates"
      columns={[
        { key: 'full_name', header: 'Ứng viên', render: (r) => r.full_name },
        { key: 'job_title', header: 'Vị trí', render: (r) => r.job_title ?? '—' },
        { key: 'stage', header: 'Vòng', render: (r) => r.stage },
        { key: 'score', header: 'Điểm', render: (r) => r.score ?? '—', className: 'mono' },
        { key: 'source', header: 'Nguồn', render: (r) => r.source ?? '—' },
        { key: 'interview_at', header: 'PV', render: (r) => r.interview_at ?? '—' },
      ]}
    />
  )
}
