import { DataTablePage } from '../../components/DataTablePage'

type UserRow = {
  id: string
  email: string
  display_name: string | null
  account_type: string
  employee_id: string | null
  is_active: number
  last_login_at: string | null
}

export function PermissionsPage() {
  return (
    <DataTablePage<UserRow>
      title="Phân quyền người dùng"
      endpoint="/api/users"
      columns={[
        { key: 'email', header: 'Email', render: (r) => r.email },
        { key: 'display_name', header: 'Tên', render: (r) => r.display_name ?? '—' },
        { key: 'account_type', header: 'Loại TK', render: (r) => r.account_type },
        {
          key: 'is_active',
          header: 'Trạng thái',
          render: (r) => (r.is_active ? 'Hoạt động' : 'Khóa'),
        },
        { key: 'employee_id', header: 'NV', render: (r) => r.employee_id ?? '—' },
        {
          key: 'last_login_at',
          header: 'Đăng nhập gần nhất',
          render: (r) => r.last_login_at?.slice(0, 16).replace('T', ' ') ?? '—',
        },
      ]}
    />
  )
}
