import { DataTablePage } from '../../components/DataTablePage'

type Slip = {
  id: string
  year_month: string
  employee_code: string
  employee_name: string
  department: string
  gross: number
  employee_insurance: number
  pit: number
  net: number
  run_status: string
}

function vnd(n: number) {
  return n.toLocaleString('vi-VN') + ' ₫'
}

export function PayslipsPage() {
  return (
    <DataTablePage<Slip>
      title="Phiếu lương điện tử"
      endpoint="/api/payroll/payslips?ym=2026-09"
      columns={[
        { key: 'year_month', header: 'Kỳ', render: (r) => r.year_month, className: 'mono' },
        { key: 'employee_code', header: 'Mã', render: (r) => r.employee_code, className: 'mono' },
        { key: 'employee_name', header: 'Nhân viên', render: (r) => r.employee_name },
        { key: 'department', header: 'Phòng ban', render: (r) => r.department },
        { key: 'gross', header: 'Tổng thu nhập', render: (r) => vnd(r.gross), className: 'mono' },
        { key: 'employee_insurance', header: 'BH NLĐ', render: (r) => vnd(r.employee_insurance), className: 'mono' },
        { key: 'pit', header: 'TNCN', render: (r) => vnd(r.pit), className: 'mono' },
        { key: 'net', header: 'Thực nhận', render: (r) => vnd(r.net), className: 'mono' },
        { key: 'run_status', header: 'Kỳ lương', render: (r) => r.run_status },
      ]}
    />
  )
}
