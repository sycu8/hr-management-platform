import { DataTablePage } from '../../components/DataTablePage'

type Trip = {
  id: string
  code: string
  destination: string
  status: string
  purpose: string
  start_at: string
}

export function TravelOverviewPage() {
  return (
    <DataTablePage<Trip>
      title="Tổng quan công tác"
      endpoint="/api/trips"
      columns={[
        { key: 'code', header: 'Mã', render: (r) => r.code, className: 'mono' },
        { key: 'destination', header: 'Điểm đến', render: (r) => r.destination },
        { key: 'purpose', header: 'Mục đích', render: (r) => r.purpose },
        { key: 'start_at', header: 'Bắt đầu', render: (r) => r.start_at.slice(0, 10) },
        { key: 'status', header: 'TT', render: (r) => r.status },
      ]}
    />
  )
}
