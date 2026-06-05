import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { useIsBdeMember } from '../lib/useIsBdeMember'
import { AccessDenied } from './AccessDenied'

export function BdeProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { loading, isBde } = useIsBdeMember()
  const location = useLocation()

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }
  // Pas connecté → login (avec la page demandée pour un message explicite).
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  // Connecté mais pas BDE → message explicite plutôt qu'une redirection muette.
  if (!isBde) {
    return (
      <AccessDenied message="Cette page est réservée aux membres du BDE." />
    )
  }
  return <>{children}</>
}
