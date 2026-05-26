import { Navigate } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <p>Chargement...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
