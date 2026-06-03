import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useIsBdeMember } from '../lib/useIsBdeMember'

export function BdeProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, isBde } = useIsBdeMember()
  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }
  if (!isBde) {
    return <Navigate to="/agenda" replace />
  }
  return <>{children}</>
}
