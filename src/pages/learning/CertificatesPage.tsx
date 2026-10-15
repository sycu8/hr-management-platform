import { DataTablePage } from '../../components/DataTablePage'

type Cert = {
  id: string
  name: string
  issuer: string | null
  issued_on: string | null
  expires_on: string | null
  employee_name: string
}

export function CertificatesPage() {
  return (
    <DataTablePage<Cert>
      title="Chứng chỉ nội bộ"
      endpoint="/api/lists/certificates"
      columns={[
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'name', header: 'Chứng chỉ', render: (r) => r.name },
        { key: 'issuer', header: 'Cấp bởi', render: (r) => r.issuer ?? '—' },
        { key: 'issued_on', header: 'Ngày cấp', render: (r) => r.issued_on ?? '—' },
        { key: 'expires_on', header: 'Hết hạn', render: (r) => r.expires_on ?? '—' },
      ]}
    />
  )
}
