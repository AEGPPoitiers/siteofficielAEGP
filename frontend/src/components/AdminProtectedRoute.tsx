import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useIsBdeMember } from '../lib/useIsBdeMember'

/** Réserve une route aux admins (is_admin). Redirige vers l'accueil sinon. */
export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useIsBdeMember()
  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
