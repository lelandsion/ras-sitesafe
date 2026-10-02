import { type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../hooks/auth-context'
import type { Profile, UserRole } from '../types/database'

export function makeProfile(
  role: UserRole,
  overrides: Partial<Profile> = {},
): Profile {
  return {
    id: overrides.id ?? `${role}-user-id`,
    display_name:
      overrides.display_name ??
      (role === 'admin' ? 'Sarah Mitchell' : 'Daniel Ortiz'),
    role,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
    updated_at: overrides.updated_at ?? '2026-01-01T00:00:00Z',
  }
}

export function makeAuthValue(
  partial: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    session: partial.session ?? null,
    user: partial.user ?? null,
    profile: partial.profile ?? null,
    role: partial.role ?? partial.profile?.role ?? null,
    loading: partial.loading ?? false,
    signIn: partial.signIn ?? (async () => ({ error: null })),
    signOut: partial.signOut ?? (async () => undefined),
  }
}

/** Router + auth provider for guard tests. Landing pads catch role redirects. */
export function AuthRoutes({
  auth,
  initialPath,
  children,
}: {
  auth: Partial<AuthContextValue>
  initialPath: string
  children: ReactNode
}) {
  const value = makeAuthValue(auth)
  return (
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          {children}
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/admin" element={<div>Admin home</div>} />
          <Route path="/framer" element={<div>Framer home</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}
