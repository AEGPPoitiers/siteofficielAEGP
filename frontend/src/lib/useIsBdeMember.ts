import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from './supabase'

type BdeStatus = { loading: boolean; isBde: boolean }

export function useIsBdeMember(): BdeStatus {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [isBdeFlag, setIsBdeFlag] = useState(false)

  useEffect(() => {
    if (authLoading || !userId) return

    let cancelled = false

    supabase
      .from('profiles')
      .select('is_bde_member, is_admin')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setIsBdeFlag(false)
        } else {
          setIsBdeFlag(!!data.is_bde_member || !!data.is_admin)
        }
        setFetchedFor(userId)
      })

    return () => {
      cancelled = true
    }
  }, [userId, authLoading])

  if (authLoading) return { loading: true, isBde: false }
  if (!userId) return { loading: false, isBde: false }
  if (fetchedFor !== userId) return { loading: true, isBde: false }
  return { loading: false, isBde: isBdeFlag }
}
