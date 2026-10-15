import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const [sideOpen, setSideOpen] = useState(false)

  const closeSide = useCallback(() => setSideOpen(false), [])
  const openSide = useCallback(() => setSideOpen(true), [])

  return (
    <div className="app">
      <Sidebar open={sideOpen} onNavigate={closeSide} />
      <div className="main">
        <Topbar onMenuClick={openSide} />
        <main className="page">
          <Outlet />
        </main>
      </div>
      {sideOpen ? (
        <div className="scrim" role="presentation" onClick={closeSide} />
      ) : null}
    </div>
  )
}
