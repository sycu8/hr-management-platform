import { DataTablePage } from '../../components/DataTablePage'

type Trip = {
  id: string
  code: string
  destination: string
  purpose: string
  start_at: string
  end_at: string
  status: string
}

export function TravelReportsPage() {
  return (
    <DataTablePage<Trip>
      title="Báo cáo công tác"
      endpoint="/api/trips?status=ok"
      columns={[
        { key: 'code', header: 'Mã', render: (r) => r.code, className: 'mono' },
        { key: 'destination', header: 'Điểm đến', render: (r) => r.destination },
        { key: 'purpose', header: 'Mục đích', render: (r) => r.purpose },
        { key: 'start_at', header: 'Bắt đầu', render: (r) => r.start_at.slice(0, 10) },
        { key: 'end_at', header: 'Kết thúc', render: (r) => r.end_at.slice(0, 10) },
        { key: 'status', header: 'TT', render: (r) => r.status },
      ]}
    />
  )
}
