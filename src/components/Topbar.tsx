import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchMe, type MeUser } from '../lib/api'
import { pageTitle } from '../lib/nav'

type TopbarProps = {
  onMenuClick: () => void
}

type MeState =
  | { status: 'loading' }
  | { status: 'ok'; user: MeUser }
  | { status: 'empty' }

export function Topbar({ onMenuClick }: TopbarProps) {
  const { pathname } = useLocation()
  const title = pageTitle(pathname)
  const [me, setMe] = useState<MeState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((user) => {
        if (!cancelled) setMe({ status: 'ok', user })
      })
      .catch(() => {
        if (!cancelled) setMe({ status: 'empty' })
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      <UserStatus me={me} />
    </header>
  )
}

function UserStatus({ me }: { me: MeState }) {
  if (me.status === 'loading') {
    return (
      <div className="user-chip loading" aria-live="polite">
        Đang tải tài khoản…
      </div>
    )
  }

  if (me.status === 'empty') {
    return (
      <div className="user-chip empty" role="status">
        Chưa đăng nhập / cấu hình Access
      </div>
    )
  }

  const { user } = me

  return (
    <div className="user-chip" title={user.email}>
      <span className="user-name">{user.displayName}</span>
      {user.role ? <span className="user-meta">{user.role}</span> : null}
    </div>
  )
}
