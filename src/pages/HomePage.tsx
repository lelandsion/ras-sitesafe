import { useEffect } from 'react'
import { ClipboardCheck, LogIn, ShieldCheck, LayoutDashboard } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { AppHeader } from '../components/layout/AppHeader'
import { useAuth } from '../hooks/auth-context'

const HOW_IT_WORKS_ID = 'how-it-works'

function scrollToHowItWorks() {
  document.getElementById(HOW_IT_WORKS_ID)?.scrollIntoView({ behavior: 'smooth' })
}

export function HomePage() {
  const { session, role, profile } = useAuth()
  const location = useLocation()
  const signedInDest = role === 'admin' ? '/admin' : role === 'framer' ? '/framer' : '/login'

  useEffect(() => {
    if (location.hash === `#${HOW_IT_WORKS_ID}`) {
      requestAnimationFrame(() => scrollToHowItWorks())
    }
  }, [location.hash])

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main app-main--landing">
        <section className="hero" aria-labelledby="hero-title">
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
            <a
              className="btn btn--ghost touch-target"
              href={`#${HOW_IT_WORKS_ID}`}
              onClick={(e) => {
                e.preventDefault()
                scrollToHowItWorks()
                window.history.replaceState(null, '', `#${HOW_IT_WORKS_ID}`)
              }}
            >
              <ShieldCheck size={20} strokeWidth={2.5} aria-hidden />
              How it works
            </a>
          </div>
          <p className="hero__meta">
            <strong>Daily Safety Check + admin dashboard.</strong> Sign in with your
            company account — framers file checklist reports with photos; admins
            review, filter, run site reports, and export PDFs.
          </p>
        </section>

        <section
          className="how-it-works"
          id={HOW_IT_WORKS_ID}
          aria-labelledby="how-it-works-title"
        >
          <p className="how-it-works__kicker">Overview</p>
          <h2 id="how-it-works-title" className="how-it-works__title">
            How it works
          </h2>
          <p className="how-it-works__lead">
            Three steps from the gate to a reviewed safety record — no public signup.
          </p>
          <ol className="how-it-works__steps">
            <li className="how-it-works__step">
              <span className="how-it-works__num" aria-hidden>
                01
              </span>
              <div className="how-it-works__icon" aria-hidden>
                <LogIn size={28} strokeWidth={2.25} />
              </div>
              <div className="how-it-works__copy">
                <h3>Sign in</h3>
                <p>
                  Use the company email your admin provisioned. There is no public
                  sign-up — demo accounts are listed in the project README.
                </p>
              </div>
            </li>
            <li className="how-it-works__step">
              <span className="how-it-works__num" aria-hidden>
                02
              </span>
              <div className="how-it-works__icon" aria-hidden>
                <ClipboardCheck size={28} strokeWidth={2.25} />
              </div>
              <div className="how-it-works__copy">
                <h3>File a daily check</h3>
                <p>
                  Framers pick an assigned jobsite, complete the checklist, add site
                  or hazard photos, then preview and submit from their phone.
                </p>
              </div>
            </li>
            <li className="how-it-works__step">
              <span className="how-it-works__num" aria-hidden>
                03
              </span>
              <div className="how-it-works__icon" aria-hidden>
                <LayoutDashboard size={28} strokeWidth={2.25} />
              </div>
              <div className="how-it-works__copy">
                <h3>Review and report</h3>
                <p>
                  Admins filter the dashboard, assign workers on Sites, generate
                  monthly reports, and export PDFs for compliance.
                </p>
              </div>
            </li>
          </ol>
          <div className="how-it-works__actions">
            <Link className="btn btn--primary touch-target" to="/login">
              <LogIn size={20} strokeWidth={2.5} aria-hidden />
              Sign in to start
            </Link>
          </div>
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Internal construction safety tool
      </footer>
    </div>
  )
}
