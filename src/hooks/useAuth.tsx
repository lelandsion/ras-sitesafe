import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { AuthContext, type AuthContextValue } from './auth-context'
import {
  getSupabase,
  isSupabaseConfigured,
  SUPABASE_CONFIG_MESSAGE,
} from '../lib/supabase'
import type { Profile, UserRole } from '../types/database'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, display_name, role, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[RAS SiteSafe] profiles fetch failed:', error.message)
    return null
  }
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let active = true
    const supabase = getSupabase()

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      const next = data.session
      setSession(next)
      setUser(next?.user ?? null)
      if (next?.user) {
        setProfile(await fetchProfile(next.user.id))
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Keep profile refresh off the auth callback critical path
      void (async () => {
        setSession(nextSession)
        setUser(nextSession?.user ?? null)
        if (nextSession?.user) {
          setProfile(await fetchProfile(nextSession.user.id))
        } else {
          setProfile(null)
        }
        setLoading(false)
      })()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: SUPABASE_CONFIG_MESSAGE }
    }
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setProfile(null)
      setSession(null)
      setUser(null)
      return
    }
    await getSupabase().auth.signOut()
    setProfile(null)
  }, [])

  const role: UserRole | null = profile?.role ?? null

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      role,
      loading,
      supabaseConfigured: isSupabaseConfigured,
      signIn,
      signOut,
    }),
    [session, user, profile, role, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
