import { DataTablePage } from '../../components/DataTablePage'
import { LEAVE_STATUS, labelOf } from '../../lib/labels'

type Leave = {
  id: string
  employee_name: string
  employee_code: string
  leave_type: string
  start_date: string
  end_date: string
  working_days: number
  status: string
}

function statusTone(status: string): string {
  if (status === 'pending') return 'warn'
  if (status === 'approved') return 'good'
  if (status === 'rejected') return 'bad'
  return ''
}

export function TeamCalendarPage() {
  return (
    <DataTablePage<Leave>
      title="Lịch nghỉ team"
      description="Đơn nghỉ phép của toàn công ty — ưu tiên trạng thái chờ duyệt."
      endpoint="/api/lists/leave-requests"
      columns={[
        {
          key: 'start_date',
          header: 'Từ',
          render: (r) => r.start_date,
          className: 'mono',
        },
        {
          key: 'end_date',
          header: 'Đến',
          render: (r) => r.end_date,
          className: 'mono',
        },
        {
          key: 'employee_code',
          header: 'Mã',
          render: (r) => r.employee_code,
          className: 'mono',
        },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'leave_type', header: 'Loại', render: (r) => r.leave_type },
        {
          key: 'working_days',
          header: 'Ngày',
          render: (r) => r.working_days,
          className: 'mono',
        },
        {
          key: 'status',
          header: 'Trạng thái',
          render: (r) => (
            <span className={`status-pill ${statusTone(r.status)}`}>
              {labelOf(LEAVE_STATUS, r.status)}
            </span>
          ),
        },
      ]}
    />
  )
}
