import { Link } from 'react-router-dom'
import { ClipboardList, LogOut } from 'lucide-react'
import { AppHeader } from '../../components/layout/AppHeader'
import { useAuth } from '../../hooks/auth-context'

/** Stub framer home — safety form + photos land in a later milestone. */
export function FramerHomePage() {
  const { profile, signOut } = useAuth()

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="role-home" aria-labelledby="framer-title">
          <p className="role-home__kicker">Framer</p>
          <h2 id="framer-title" className="role-home__title">
            Field safety
            <span>Stub — Milestone 1</span>
          </h2>
          <p className="role-home__lead">
            Signed in as <strong>{profile?.display_name ?? 'Framer'}</strong>. Safety forms and
            photo upload land in Milestone 2 — this route confirms role guards work.
          </p>
          <div className="role-home__actions">
            <button type="button" className="btn btn--ghost touch-target" onClick={() => void signOut()}>
              <LogOut size={20} strokeWidth={2.5} aria-hidden />
              Sign out
            </button>
            <Link className="btn btn--primary touch-target" to="/">
              <ClipboardList size={20} strokeWidth={2.5} aria-hidden />
              Overview
            </Link>
          </div>
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Framer
      </footer>
    </div>
  )
}
