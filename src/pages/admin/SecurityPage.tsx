import { useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'

type Settings = {
  maskSalary: boolean
  require2fa: boolean
  sessionMinutes: number
  logExports: boolean
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; settings: Settings | null }
  | { status: 'error'; message: string }

export function SecurityPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchJson<{ settings: Settings | null }>('/api/lists/security')
      .then((r) => {
        if (!cancelled) setState({ status: 'ok', settings: r.settings })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Không tải được',
          })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="card empty">
        <p>Đang tải cấu hình bảo mật…</p>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{state.message}</p>
      </div>
    )
  }
  if (!state.settings) {
    return (
      <div className="card empty">
        <h2>Bảo mật dữ liệu</h2>
        <p>Chưa cấu hình bảo mật cho tổ chức.</p>
      </div>
    )
  }

  const s = state.settings
  const rows = [
    {
      label: 'Che lương khi xem hồ sơ',
      value: s.maskSalary ? 'Bật' : 'Tắt',
      tone: s.maskSalary ? 'good' : 'warn',
    },
    {
      label: 'Bắt buộc xác thực 2 bước',
      value: s.require2fa ? 'Bật' : 'Tắt',
      tone: s.require2fa ? 'good' : 'warn',
    },
    {
      label: 'Thời gian phiên đăng nhập',
      value: `${s.sessionMinutes} phút`,
      tone: 'info',
    },
    {
      label: 'Ghi nhật ký xuất dữ liệu',
      value: s.logExports ? 'Bật' : 'Tắt',
      tone: s.logExports ? 'good' : 'warn',
    },
  ] as const

  return (
    <div className="stack">
      <p className="page-lead muted">
        Chính sách bảo vệ dữ liệu nhân sự của tổ chức. Chỉ Super Admin / Admin hệ
        thống được xem.
      </p>
      <div className="grid g2">
        {rows.map((r) => (
          <div key={r.label} className="tile">
            <div className="muted small">{r.label}</div>
            <div className="v" style={{ fontSize: 22, marginTop: 8 }}>
              <span className={`status-pill ${r.tone}`}>{r.value}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Ghi chú vận hành</h2>
        <ul className="feed-list">
          <li>
            <div className="feed-when">RBAC</div>
            <div>
              <strong>Phân quyền theo module</strong>
              <div className="muted small">
                Xem chi tiết tại menu Phân quyền người dùng.
              </div>
            </div>
          </li>
          <li>
            <div className="feed-when">Audit</div>
            <div>
              <strong>Nhật ký thao tác</strong>
              <div className="muted small">
                Mọi duyệt phép, sửa hồ sơ, xuất dữ liệu được ghi vào audit log.
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  )
}
