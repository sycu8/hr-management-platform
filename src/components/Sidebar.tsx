import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { findNavModule, NAV_MAP } from '../lib/nav'

type SidebarProps = {
  open: boolean
  onNavigate: () => void
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const { pathname } = useLocation()
  const activeModule = findNavModule(pathname)
  const [userToggled, setUserToggled] = useState<Record<string, boolean>>({})

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
        <div className="logo" aria-hidden="true">
          H
        </div>
        <div>
          <b>HRM Portal</b>
          <small>Quản lý nhân sự nội bộ</small>
        </div>
      </div>

      {NAV_MAP.map((mod) => (
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
