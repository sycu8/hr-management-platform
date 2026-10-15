import { DataTablePage } from '../../components/DataTablePage'

type Policy = {
  id: string
  code: string
  title: string
  version: string | null
  effective_from: string | null
  summary: string | null
}

export function LegalPage() {
  return (
    <DataTablePage<Policy>
      title="Văn bản pháp lý"
      endpoint={`/api/lists/policies?category=${encodeURIComponent('Pháp lý')}`}
      columns={[
        { key: 'code', header: 'Mã', render: (r) => r.code, className: 'mono' },
        { key: 'title', header: 'Tiêu đề', render: (r) => r.title },
        { key: 'version', header: 'Phiên bản', render: (r) => r.version ?? '—' },
        { key: 'effective_from', header: 'Hiệu lực', render: (r) => r.effective_from ?? '—' },
        { key: 'summary', header: 'Tóm tắt', render: (r) => r.summary ?? '—' },
      ]}
    />
  )
}
