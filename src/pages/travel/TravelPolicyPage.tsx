import { DataTablePage } from '../../components/DataTablePage'

type Policy = {
  id: string
  version: number
  effective_from: string
  effective_to: string | null
  approved_by: string | null
  approved_at: string | null
}

export function TravelPolicyPage() {
  return (
    <DataTablePage<Policy>
      title="Chính sách công tác phí"
      endpoint="/api/lists/travel-policy"
      columns={[
        { key: 'version', header: 'Phiên bản', render: (r) => `v${r.version}`, className: 'mono' },
        { key: 'effective_from', header: 'Hiệu lực từ', render: (r) => r.effective_from },
        { key: 'effective_to', header: 'Đến', render: (r) => r.effective_to ?? 'Hiện hành' },
        { key: 'approved_by', header: 'Duyệt bởi', render: (r) => r.approved_by ?? '—' },
        {
          key: 'approved_at',
          header: 'Ngày duyệt',
          render: (r) => r.approved_at?.slice(0, 10) ?? '—',
        },
      ]}
    />
  )
}
