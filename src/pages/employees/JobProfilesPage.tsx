import { DataTablePage } from '../../components/DataTablePage'

type Profile = {
  id: string
  code: string
  full_name: string
  department: string
  title: string
  contract_type: string
  contract_start: string | null
  contract_end: string | null
  joined_on: string
}

export function JobProfilesPage() {
  return (
    <DataTablePage<Profile>
      title="Hồ sơ công việc"
      endpoint="/api/lists/job-profiles"
      columns={[
        { key: 'code', header: 'Mã', render: (r) => r.code, className: 'mono' },
        { key: 'full_name', header: 'Họ tên', render: (r) => r.full_name },
        { key: 'department', header: 'Phòng ban', render: (r) => r.department },
        { key: 'title', header: 'Chức danh', render: (r) => r.title },
        { key: 'contract_type', header: 'HĐ', render: (r) => r.contract_type },
        { key: 'contract_start', header: 'Bắt đầu HĐ', render: (r) => r.contract_start ?? '—' },
        { key: 'contract_end', header: 'Hết hạn HĐ', render: (r) => r.contract_end ?? '—' },
      ]}
    />
  )
}
