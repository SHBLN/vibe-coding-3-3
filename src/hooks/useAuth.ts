import { useCallback, useEffect, useState } from 'react'
import { getAuthAccount, signOut as signOutUser, type AuthAccount } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [account, setAccount] = useState<AuthAccount | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const nextAccount = await getAuthAccount()
      setAccount(nextAccount)
    } catch {
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [refresh])

  const signOut = useCallback(async () => {
    await signOutUser()
    setAccount(null)
  }, [])

  return {
    account,
    loading,
    refresh,
    signOut,
    isAuthenticated: Boolean(account),
    profileComplete: account?.profileComplete ?? false,
  }
}
