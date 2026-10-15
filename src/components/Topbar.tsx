import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { pageTitle } from '../lib/nav'

type TopbarProps = {
  onMenuClick: () => void
}

const TYPE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin (HR)',
  user: 'User',
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { pathname } = useLocation()
  const title = pageTitle(pathname)
  const { user, logout } = useAuth()

  return (
    <header className="top">
      <button
        type="button"
        className="burger"
        aria-label="Mở menu"
        onClick={onMenuClick}
      >
        ☰
      </button>
      <h1>{title}</h1>
      {user ? (
        <div className="user-chip" title={user.email}>
          <div className="user-chip-text">
            <span className="user-name">{user.displayName}</span>
            <span className="user-meta">
              {TYPE_LABEL[user.accountType] ?? user.accountType}
              {user.viewAsUserId ? ' · đang xem hộ' : ''}
            </span>
          </div>
          <button
            type="button"
            className="linkish"
            onClick={() => void logout()}
          >
            Đăng xuất
          </button>
        </div>
      ) : null}
    </header>
  )
}
