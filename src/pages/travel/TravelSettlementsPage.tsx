import { DataTablePage } from '../../components/DataTablePage'

type Trip = {
  id: string
  code: string
  destination: string
  purpose: string
  start_at: string
  status: string
}

export function TravelSettlementsPage() {
  return (
    <DataTablePage<Trip>
      title="Quyết toán"
      endpoint="/api/trips?status=st"
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
