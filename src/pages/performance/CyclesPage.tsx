import { DataTablePage } from '../../components/DataTablePage'

type Cycle = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
}

export function CyclesPage() {
  return (
    <DataTablePage<Cycle>
      title="Chu kỳ đánh giá"
      endpoint="/api/lists/cycles"
      columns={[
        { key: 'name', header: 'Chu kỳ', render: (r) => r.name },
        { key: 'start_date', header: 'Bắt đầu', render: (r) => r.start_date },
        { key: 'end_date', header: 'Kết thúc', render: (r) => r.end_date },
        { key: 'status', header: 'TT', render: (r) => r.status },
      ]}
    />
  )
}
