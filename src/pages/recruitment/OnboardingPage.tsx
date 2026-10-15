import { DataTablePage } from '../../components/DataTablePage'

type Plan = {
  id: string
  full_name: string
  role_title: string | null
  department: string | null
  start_date: string
}

export function OnboardingPage() {
  return (
    <DataTablePage<Plan>
      title="Onboarding"
      endpoint="/api/lists/onboarding"
      columns={[
        { key: 'full_name', header: 'Họ tên', render: (r) => r.full_name },
        { key: 'role_title', header: 'Vị trí', render: (r) => r.role_title ?? '—' },
        { key: 'department', header: 'Phòng ban', render: (r) => r.department ?? '—' },
        { key: 'start_date', header: 'Ngày vào', render: (r) => r.start_date },
      ]}
    />
  )
}
