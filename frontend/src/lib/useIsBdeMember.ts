import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from './supabase'

type BdeStatus = {
  loading: boolean
  /** Membre BDE ou admin → accès à l'admin BDE (agenda, boîte à idées, tutorat). */
  isBde: boolean
  /** Peut éditer le tutorat : BDE/admin OU tuteur (is_tutor). Les tuteurs n'ont
   *  ce droit QUE sur le tutorat. */
  canEditTutorat: boolean
}

export function useIsBdeMember(): BdeStatus {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [isBdeFlag, setIsBdeFlag] = useState(false)
  const [isTutorFlag, setIsTutorFlag] = useState(false)

  useEffect(() => {
    if (authLoading || !userId) return

    let cancelled = false

    supabase
      .from('profiles')
      .select('is_bde_member, is_admin, is_tutor')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setIsBdeFlag(false)
          setIsTutorFlag(false)
        } else {
          setIsBdeFlag(!!data.is_bde_member || !!data.is_admin)
          setIsTutorFlag(!!data.is_tutor)
        }
        setFetchedFor(userId)
      })

    return () => {
      cancelled = true
    }
  }, [userId, authLoading])

  const idle = { loading: true, isBde: false, canEditTutorat: false }
  if (authLoading) return idle
  if (!userId) return { loading: false, isBde: false, canEditTutorat: false }
  if (fetchedFor !== userId) return idle
  return {
    loading: false,
    isBde: isBdeFlag,
    canEditTutorat: isBdeFlag || isTutorFlag,
  }
}
