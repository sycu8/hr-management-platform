import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { findNavModule, NAV_MAP } from '../lib/nav'

type SidebarProps = {
  open: boolean
  onNavigate: () => void
  onClose: () => void
}

export function Sidebar({ open, onNavigate, onClose }: SidebarProps) {
  const { pathname } = useLocation()
  const activeModule = findNavModule(pathname)
  const { user } = useAuth()
  const allowed = new Set(user?.modules ?? [])
  const [openKey, setOpenKey] = useState<string | null>(
    activeModule?.key ?? 'dash',
  )

  useEffect(() => {
    if (activeModule?.key) setOpenKey(activeModule.key)
  }, [activeModule?.key])

  const modules = NAV_MAP.filter(
    (m) => allowed.size === 0 || allowed.has(m.key),
  ).map((mod) => {
    if (mod.key !== 'sys') return mod
    const items = mod.items.filter(
      (item) =>
        item.id !== 'integ' || !!user?.canManageDataSources,
    )
    return { ...mod, items }
  })

  return (
    <aside
      className={`side${open ? ' open' : ''}`}
      id="side"
      aria-label="Điều hướng"
    >
      <div className="side-head">
        <div className="brand">
          <img
            className="brand-logo"
            src="/logo.svg"
            width={34}
            height={34}
            alt=""
          />
          <div>
            <b>HR Management Platform</b>
            <small>Orange Cloud</small>
          </div>
        </div>
        <button
          type="button"
          className="side-close"
          aria-label="Đóng menu"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <nav className="side-nav" aria-label="Module">
        {modules.map((mod) => {
          const isOpen = openKey === mod.key
          const isActiveGroup = activeModule?.key === mod.key
          return (
            <details
              key={mod.key}
              className={`grp${mod.isNew ? ' hl' : ''}${
                isActiveGroup ? ' is-active-group' : ''
              }`}
              open={isOpen}
            >
              <summary
                onClick={(e) => {
                  e.preventDefault()
                  // Accordion: one module open at a time
                  setOpenKey((cur) => (cur === mod.key ? null : mod.key))
                }}
              >
                <span className="dot" style={{ background: mod.color }} />
                <span className="grp-name">{mod.name}</span>
                {mod.isNew ? <span className="badge-new">Mới</span> : null}
                <span className="grp-chevron" aria-hidden>
                  {isOpen ? '▾' : '▸'}
                </span>
              </summary>
              <div className="grp-items">
                {mod.items.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `nav-i${isActive ? ' on' : ''}`
                    }
                    onClick={onNavigate}
                  >
                    {item.title}
                  </NavLink>
                ))}
              </div>
            </details>
          )
        })}
      </nav>
    </aside>
  )
}
