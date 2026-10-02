import { useState, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import rasLogo from '../../assets/branding/ras-logo-no-text.png'
import { useAuth } from '../../hooks/auth-context'

const HOW_IT_WORKS_HASH = '#how-it-works'

/**
 * Branded app shell header — RAS / SITESAFE / Site Safety & Compliance.
 * Official RAS header mark from rasltd.ca (not invented).
 */
export function AppHeader() {
  const [navOpen, setNavOpen] = useState(false)
  const { session, role, signOut } = useAuth()
  const location = useLocation()

  function goToHowItWorks(e: MouseEvent<HTMLAnchorElement>) {
    setNavOpen(false)
    if (location.pathname === '/') {
      e.preventDefault()
      document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
      window.history.replaceState(null, '', HOW_IT_WORKS_HASH)
    }
  }

  return (
    <header
      className={`app-header${navOpen ? ' app-header--nav-open' : ''}`}
      role="banner"
    >
      <div className="app-header__row">
        <Link
          to="/"
          className="app-header__brand-lockup"
          onClick={() => setNavOpen(false)}
          aria-label="RAS SiteSafe home"
        >
          <img
            className="app-header__logo"
            src={rasLogo}
            alt=""
            width={808}
            height={534}
            decoding="async"
          />
          <div className="app-header__wordmark">
            <span className="app-header__brand">RAS</span>
            <h1 className="app-header__product">SITESAFE</h1>
            <p className="app-header__tag">Site Safety &amp; Compliance</p>
          </div>
        </Link>
        <button
          type="button"
          className="app-header__menu touch-target"
          aria-expanded={navOpen}
          aria-controls="app-nav"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setNavOpen((open) => !open)}
        >
          {navOpen ? <X size={22} strokeWidth={2.5} /> : <Menu size={22} strokeWidth={2.5} />}
        </button>
      </div>
      <nav id="app-nav" className="app-header__nav" aria-label="Primary">
        <Link to={{ pathname: '/', hash: 'how-it-works' }} onClick={goToHowItWorks}>
          Overview
        </Link>
        {session ? (
          <>
            <Link
              to={role === 'admin' ? '/admin' : '/framer'}
              onClick={() => setNavOpen(false)}
            >
              {role === 'admin' ? 'Dashboard' : 'Field'}
            </Link>
            {role === 'admin' && (
              <Link to="/admin/reports" onClick={() => setNavOpen(false)}>
                Reports
              </Link>
            )}
            {role === 'admin' && (
              <Link to="/admin/sites" onClick={() => setNavOpen(false)}>
                Sites
              </Link>
            )}
            <Link to="/account" onClick={() => setNavOpen(false)}>
              Account
            </Link>
            <button
              type="button"
              className="app-header__nav-btn"
              onClick={() => {
                setNavOpen(false)
                void signOut()
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login" onClick={() => setNavOpen(false)}>
            Sign in
          </Link>
        )}
      </nav>
    </header>
  )
}
