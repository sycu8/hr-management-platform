import { DataTablePage } from '../../components/DataTablePage'
import { TRIP_STATUS, labelOf } from '../../lib/labels'

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
      description="Các chuyến đã hoàn tất quyết toán — dùng để đối soát chi phí."
      endpoint="/api/trips?status=ok"
      columns={[
        { key: 'code', header: 'Mã', render: (r) => r.code, className: 'mono' },
        {
          key: 'destination',
          header: 'Điểm đến',
          render: (r) => r.destination,
          className: 'cell-wrap',
        },
        {
          key: 'purpose',
          header: 'Mục đích',
          render: (r) => r.purpose,
          className: 'cell-wrap',
        },
        {
          key: 'start_at',
          header: 'Bắt đầu',
          render: (r) => r.start_at.slice(0, 10),
          className: 'mono',
        },
        {
          key: 'end_at',
          header: 'Kết thúc',
          render: (r) => r.end_at.slice(0, 10),
          className: 'mono',
        },
        {
          key: 'status',
          header: 'Trạng thái',
          render: (r) => (
            <span className="status-pill good">
              {labelOf(TRIP_STATUS, r.status)}
            </span>
          ),
        },
      ]}
    />
  )
}
