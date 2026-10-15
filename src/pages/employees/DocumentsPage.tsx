import { DataTablePage } from '../../components/DataTablePage'

type Doc = {
  id: string
  type_name: string
  file_name: string
  issued_on: string | null
  expires_on: string | null
  employee_name: string
  employee_code: string
}

export function DocumentsPage() {
  return (
    <DataTablePage<Doc>
      title="Tài liệu nhân sự"
      endpoint="/api/lists/documents"
      columns={[
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'type_name', header: 'Loại', render: (r) => r.type_name },
        { key: 'file_name', header: 'Tệp', render: (r) => r.file_name },
        { key: 'issued_on', header: 'Cấp', render: (r) => r.issued_on ?? '—' },
        { key: 'expires_on', header: 'Hết hạn', render: (r) => r.expires_on ?? '—' },
      ]}
    />
  )
}
