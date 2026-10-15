import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { findNavModule, pageTitle } from '../lib/nav'
import { GlobalSearch } from './GlobalSearch'

type TopbarProps = {
  onMenuClick: () => void
  menuOpen?: boolean
}

const TYPE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin (HR)',
  user: 'User',
}

export function Topbar({ onMenuClick, menuOpen = false }: TopbarProps) {
  const { pathname } = useLocation()
  const title = pageTitle(pathname)
  const mod = findNavModule(pathname)
  const { user, logout } = useAuth()

  return (
    <header className="top">
      <div className="top-row top-row--main">
        <button
          type="button"
          className="burger"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          aria-controls="side"
          onClick={onMenuClick}
        >
          <span className="burger-icon" aria-hidden>
            {menuOpen ? '✕' : '☰'}
          </span>
        </button>
        <div className="top-titles">
          <h1>{title}</h1>
          {mod ? (
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link to="/" className="crumbs-home">
                Trang chủ
              </Link>
              <span className="crumbs-sep" aria-hidden>
                /
              </span>
              <span className="crumbs-mod">{mod.name}</span>
              <span className="crumbs-sep crumbs-sep--full" aria-hidden>
                /
              </span>
              <span className="crumbs-current">{title}</span>
            </nav>
          ) : null}
        </div>
        <GlobalSearch />
        {user ? (
          <div className="user-chip" title={user.email}>
            <div className="user-avatar" aria-hidden>
              {(user.displayName || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="user-chip-text">
              <span className="user-name">{user.displayName}</span>
              <span className="user-meta">
                {TYPE_LABEL[user.accountType] ?? user.accountType}
                {user.viewAsUserId ? ' · đang xem hộ' : ''}
              </span>
            </div>
            <button
              type="button"
              className="btn logout-btn"
              onClick={() => void logout()}
            >
              Đăng xuất
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
