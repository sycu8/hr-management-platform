import { DataTablePage } from '../../components/DataTablePage'

type Path = {
  id: string
  name: string
  levels_json: string
}

function levelCount(json: string): string {
  try {
    const arr = JSON.parse(json) as unknown
    return Array.isArray(arr) ? String(arr.length) : '—'
  } catch {
    return '—'
  }
}

export function CareersPage() {
  return (
    <DataTablePage<Path>
      title="Lộ trình nghề nghiệp"
      endpoint="/api/lists/careers"
      columns={[
        { key: 'name', header: 'Lộ trình', render: (r) => r.name },
        { key: 'levels', header: 'Số cấp', render: (r) => levelCount(r.levels_json), className: 'mono' },
      ]}
    />
  )
}
