import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { findNavModule, pageTitle } from '../lib/nav'
import { GlobalSearch } from './GlobalSearch'

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
  const mod = findNavModule(pathname)
  const { user, logout } = useAuth()

  return (
    <header className="top">
      <div className="top-row top-row--main">
        <button
          type="button"
          className="burger"
          aria-label="Mở menu"
          onClick={onMenuClick}
        >
          ☰
        </button>
        <div className="top-titles">
          <h1>{title}</h1>
          {mod ? (
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link to="/">Trang chủ</Link>
              <span aria-hidden>/</span>
              <span>{mod.name}</span>
              <span aria-hidden>/</span>
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
              className="linkish"
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
