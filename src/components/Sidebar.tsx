import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { findNavModule, NAV_MAP } from '../lib/nav'

type SidebarProps = {
  open: boolean
  onNavigate: () => void
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const { pathname } = useLocation()
  const activeModule = findNavModule(pathname)
  const { user } = useAuth()
  const allowed = new Set(user?.modules ?? [])
  const [userToggled, setUserToggled] = useState<Record<string, boolean>>({})

  const modules = NAV_MAP.filter(
    (m) => allowed.size === 0 || allowed.has(m.key),
  )

  function isGroupOpen(key: string): boolean {
    if (Object.hasOwn(userToggled, key)) return userToggled[key]!
    return (
      key === 'dash' ||
      key === activeModule?.key ||
      !!NAV_MAP.find((m) => m.key === key)?.isNew
    )
  }

  return (
    <aside
      className={`side${open ? ' open' : ''}`}
      id="side"
      aria-label="Điều hướng"
    >
      <div className="brand">
        <img className="brand-logo" src="/logo.svg" width={34} height={34} alt="" />
        <div>
          <b>HR Management Platform</b>
          <small>Orange Cloud</small>
        </div>
      </div>

      {modules.map((mod) => (
        <details
          key={mod.key}
          className={`grp${mod.isNew ? ' hl' : ''}`}
          open={isGroupOpen(mod.key)}
          onToggle={(e) => {
            const next = (e.currentTarget as HTMLDetailsElement).open
            setUserToggled((prev) => ({ ...prev, [mod.key]: next }))
          }}
        >
          <summary>
            <span className="dot" style={{ background: mod.color }} />
            {mod.name}
            {mod.isNew ? <span className="badge-new">Mới</span> : null}
          </summary>
          {mod.items.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-i${isActive ? ' on' : ''}`}
              onClick={onNavigate}
            >
              {item.title}
            </NavLink>
          ))}
        </details>
      ))}
    </aside>
  )
}
