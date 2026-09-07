import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

type ProtectedRouteProps = {
  children: ReactNode
  requireCompleteProfile?: boolean
}

export function ProtectedRoute({ children, requireCompleteProfile = true }: ProtectedRouteProps) {
  const { isAuthenticated, profileComplete, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="text-sm text-navy/50">Загрузка…</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (requireCompleteProfile && !profileComplete) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
