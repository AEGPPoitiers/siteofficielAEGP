import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }

  if (!user) {
    // On retient la page demandée pour afficher un message explicite côté Login.
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}
