import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from './supabase'

type BdeStatus = {
  loading: boolean
  /** Membre BDE ou admin → accès à l'admin BDE (agenda, boîte à idées, tutorat). */
  isBde: boolean
  /** Admin (is_admin) → gestion des rôles. */
  isAdmin: boolean
  /** Peut éditer le tutorat : BDE/admin OU tuteur (is_tutor). Les tuteurs n'ont
   *  ce droit QUE sur le tutorat. */
  canEditTutorat: boolean
  /** Peut gérer les actualités : BDE/admin OU com (is_com). Les membres com
   *  n'ont ce droit QUE sur les actualités. */
  canEditNews: boolean
}

export function useIsBdeMember(): BdeStatus {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [isBdeFlag, setIsBdeFlag] = useState(false)
  const [isAdminFlag, setIsAdminFlag] = useState(false)
  const [isTutorFlag, setIsTutorFlag] = useState(false)
  const [isComFlag, setIsComFlag] = useState(false)

  useEffect(() => {
    if (authLoading || !userId) return

    let cancelled = false

    supabase
      .from('profiles')
      .select('is_admin, is_tutor, is_com')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setIsBdeFlag(false)
          setIsAdminFlag(false)
          setIsTutorFlag(false)
          setIsComFlag(false)
        } else {
          setIsBdeFlag(!!data.is_admin)
          setIsAdminFlag(!!data.is_admin)
          setIsTutorFlag(!!data.is_tutor)
          setIsComFlag(!!data.is_com)
        }
        setFetchedFor(userId)
      })

    return () => {
      cancelled = true
    }
  }, [userId, authLoading])

  const idle = {
    loading: true,
    isBde: false,
    isAdmin: false,
    canEditTutorat: false,
    canEditNews: false,
  }
  if (authLoading) return idle
  if (!userId)
    return {
      loading: false,
      isBde: false,
      isAdmin: false,
      canEditTutorat: false,
      canEditNews: false,
    }
  if (fetchedFor !== userId) return idle
  return {
    loading: false,
    isBde: isBdeFlag,
    isAdmin: isAdminFlag,
    canEditTutorat: isBdeFlag || isTutorFlag,
    canEditNews: isBdeFlag || isComFlag,
  }
}
