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

export function InsurancePage() {
  return (
    <DataTablePage<Doc>
      title="Bảo hiểm XH/YT"
      endpoint="/api/lists/documents"
      columns={[
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'type_name', header: 'Loại hồ sơ', render: (r) => r.type_name },
        { key: 'file_name', header: 'Tệp', render: (r) => r.file_name },
        { key: 'issued_on', header: 'Cấp', render: (r) => r.issued_on ?? '—' },
      ]}
    />
  )
}
