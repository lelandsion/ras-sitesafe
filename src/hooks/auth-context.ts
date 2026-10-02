import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, UserRole } from '../types/database'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: UserRole | null
  loading: boolean
  /** False when VITE_SUPABASE_* env vars are missing (app shell still renders). */
  supabaseConfigured: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
