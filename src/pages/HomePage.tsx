import { LogIn, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/layout/AppHeader'
import { useAuth } from '../hooks/auth-context'

export function HomePage() {
  const { session, role, profile } = useAuth()
  const signedInDest = role === 'admin' ? '/admin' : role === 'framer' ? '/framer' : '/login'

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="hero" id="overview" aria-labelledby="hero-title">
          <p className="hero__kicker">Ron Anderson &amp; Sons</p>
          <h2 id="hero-title" className="hero__title">
            SiteSafe
            <span>On every job.</span>
          </h2>
          <p className="hero__lead">
            Mobile-first site safety forms and compliance for RAS framing crews —
            built for phones in the field, not desks in the office.
          </p>
          <div className="hero__actions">
            <Link className="btn btn--primary touch-target" to={signedInDest}>
              <LogIn size={20} strokeWidth={2.5} aria-hidden />
              {session ? `Continue as ${profile?.display_name ?? role}` : 'Sign in'}
            </Link>
            <a className="btn btn--ghost touch-target" href="#overview">
              <ShieldCheck size={20} strokeWidth={2.5} aria-hidden />
              How it works
            </a>
          </div>
          <p className="hero__meta">
            <strong>Login &amp; roles ready.</strong> Apply the SQL migration, seed demo
            users, then sign in as Admin or Framer. Forms and dashboard come next.
          </p>
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Internal construction safety tool
      </footer>
    </div>
  )
}
