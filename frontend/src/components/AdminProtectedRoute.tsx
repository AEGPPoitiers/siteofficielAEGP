import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { useIsBdeMember } from '../lib/useIsBdeMember'
import { AccessDenied } from './AccessDenied'

/** Réserve une route aux admins (is_admin). */
export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { loading, isAdmin } = useIsBdeMember()
  const location = useLocation()

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }
  // Pas connecté → login (et non l'accueil), avec la page demandée.
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (!isAdmin) {
    return (
      <AccessDenied message="Cette page est réservée aux administrateurs." />
    )
  }
  return <>{children}</>
}
