import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

/** Gate data-source / integration screens to Super Admin only. */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user, state } = useAuth()
  if (state.status === 'loading') return null
  if (!user?.canManageDataSources) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
