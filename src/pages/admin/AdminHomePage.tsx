import { Link } from 'react-router-dom'
import { LogOut, Shield } from 'lucide-react'
import { AppHeader } from '../../components/layout/AppHeader'
import { useAuth } from '../../hooks/auth-context'

/** Stub admin home — dashboard / charts land in a later milestone. */
export function AdminHomePage() {
  const { profile, signOut } = useAuth()

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="role-home" aria-labelledby="admin-title">
          <p className="role-home__kicker">Admin</p>
          <h2 id="admin-title" className="role-home__title">
            Compliance desk
            <span>Stub — Milestone 1</span>
          </h2>
          <p className="role-home__lead">
            Signed in as <strong>{profile?.display_name ?? 'Admin'}</strong>. Submissions
            dashboard and Recharts land after login/roles (Milestone 2).
          </p>
          <div className="role-home__actions">
            <button type="button" className="btn btn--ghost touch-target" onClick={() => void signOut()}>
              <LogOut size={20} strokeWidth={2.5} aria-hidden />
              Sign out
            </button>
            <Link className="btn btn--primary touch-target" to="/">
              <Shield size={20} strokeWidth={2.5} aria-hidden />
              Overview
            </Link>
          </div>
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Admin
      </footer>
    </div>
  )
}
