import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/auth-context'
import type { UserRole } from '../../types/database'
import { SupabaseConfigNotice } from './SupabaseConfigNotice'

function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <p>{label}</p>
    </div>
  )
}

/** Requires a signed-in session. Optionally requires a specific role. */
export function RequireAuth({ role }: { role?: UserRole }) {
  const { session, profile, loading, role: userRole, signOut, supabaseConfigured } =
    useAuth()
  const location = useLocation()

  if (!supabaseConfigured) {
    return <SupabaseConfigNotice title="Sign-in unavailable" />
  }

  if (loading) {
    return <LoadingScreen label="Checking session…" />
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!profile) {
    return (
      <div className="auth-loading" role="alert">
        <p>
          Your account is signed in but not set up for SiteSafe yet. Ask an admin
          to finish provisioning your profile, then sign in again.
        </p>
        <button
          type="button"
          className="btn btn--primary touch-target"
          style={{ marginTop: '1rem' }}
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    )
  }

  if (role && userRole !== role) {
    const fallback = userRole === 'admin' ? '/admin' : '/framer'
    return <Navigate to={fallback} replace />
  }

  return <Outlet />
}

/** Sends signed-in users away from /login to their role home. */
export function RedirectIfAuthed() {
  const { session, profile, loading, role } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (session && profile) {
    return <Navigate to={role === 'admin' ? '/admin' : '/framer'} replace />
  }

  return <Outlet />
}
