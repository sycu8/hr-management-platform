import { useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'

type DashboardSummary = {
  activeEmployees: number
  leftEmployees: number
  turnover12mPct: number
  presenceToday: number | null
  openTasks: number
  byDepartment: { department: string; count: number }[]
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: DashboardSummary }
  | { status: 'error'; message: string }

export function DashboardPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchJson<DashboardSummary>('/api/dashboard/summary')
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Không tải được tổng quan'
        setState({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return <div className="card empty">Đang tải tổng quan nhân sự…</div>
  }

  if (state.status === 'error') {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{state.message}</p>
      </div>
    )
  }

  const { data } = state

  return (
    <div className="stack">
      <div className="grid g4">
        <div className="tile">
          <div className="v">{data.activeEmployees}</div>
          <div className="muted small">Nhân sự đang làm việc</div>
        </div>
        <div className="tile">
          <div className="v">
            {data.presenceToday == null ? '—' : data.presenceToday}
          </div>
          <div className="muted small">Hiện diện hôm nay</div>
        </div>
        <div className="tile">
          <div className="v">{data.turnover12mPct}%</div>
          <div className="muted small">Tỷ lệ nghỉ việc (demo)</div>
        </div>
        <div className="tile">
          <div className="v">{data.openTasks}</div>
          <div className="muted small">Việc cần xử lý</div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>Nhân sự theo phòng ban</h2>
          {data.byDepartment.length === 0 ? (
            <div className="empty">Chưa có dữ liệu từ kho dùng chung.</div>
          ) : (
            <ul className="dept-list">
              {data.byDepartment.map((row) => (
                <li key={row.department}>
                  <span>{row.department}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2>Hôm nay</h2>
          <div className="empty">
            Chấm công theo ngày thật sẽ hiển thị khi có punch / import.
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>Cảnh báo & nhắc việc</h2>
          <div className="empty">
            {data.openTasks > 0
              ? `Có ${data.openTasks} việc nghỉ phép / công tác đang chờ.`
              : 'Không có cảnh báo.'}
          </div>
        </div>
        <div className="card">
          <h2>Sự kiện sắp tới</h2>
          <div className="empty">Chưa có sự kiện.</div>
        </div>
      </div>

      <p className="ex">
        Ngày hệ thống dùng ngày hiện tại thật. Tài khoản Access được tự tạo trong
        tổ chức demo khi đăng nhập lần đầu; nâng quyền (HR/Admin) cần cập nhật
        trong bảng users.
      </p>
    </div>
  )
}
