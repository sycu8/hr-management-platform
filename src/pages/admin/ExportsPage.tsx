import { DataTablePage } from '../../components/DataTablePage'

type Job = {
  id: string
  kind: string
  status: string
  r2_key: string | null
  requested_by: string | null
  created_at: string
  completed_at: string | null
}

export function ExportsPage() {
  return (
    <DataTablePage<Job>
      title="Báo cáo & xuất dữ liệu"
      description="Lịch sử yêu cầu xuất. Tải file khi trạng thái hoàn tất."
      endpoint="/api/lists/exports"
      columns={[
        { key: 'kind', header: 'Loại', render: (r) => r.kind },
        { key: 'status', header: 'TT', render: (r) => r.status },
        {
          key: 'r2_key',
          header: 'Tệp',
          render: (r) => r.r2_key ?? '—',
          className: 'mono',
        },
        {
          key: 'requested_by',
          header: 'Người yêu cầu',
          render: (r) => r.requested_by ?? '—',
        },
        {
          key: 'created_at',
          header: 'Tạo',
          render: (r) => r.created_at.slice(0, 16).replace('T', ' '),
        },
        {
          key: 'completed_at',
          header: 'Xong',
          render: (r) =>
            r.completed_at
              ? r.completed_at.slice(0, 16).replace('T', ' ')
              : '—',
        },
      ]}
    />
  )
}
