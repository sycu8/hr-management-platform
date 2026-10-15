import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const [sideOpen, setSideOpen] = useState(false)

  const closeSide = useCallback(() => setSideOpen(false), [])
  const toggleSide = useCallback(() => setSideOpen((v) => !v), [])

  useEffect(() => {
    if (!sideOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSide()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [sideOpen, closeSide])

  return (
    <div className={`app${sideOpen ? ' app--nav-open' : ''}`}>
      <Sidebar open={sideOpen} onNavigate={closeSide} onClose={closeSide} />
      <div className="main" inert={sideOpen}>
        <Topbar
          onMenuClick={toggleSide}
          menuOpen={sideOpen}
        />
        <main className="page">
          <Outlet />
        </main>
      </div>
      {sideOpen ? (
        <button
          type="button"
          className="scrim"
          aria-label="Đóng menu"
          onClick={closeSide}
        />
      ) : null}
    </div>
  )
}
