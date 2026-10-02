import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import rasLogo from '../../assets/branding/ras-logo-no-text.png'
import { useAuth } from '../../hooks/auth-context'

/**
 * Branded app shell header — RAS / SITESAFE / Site Safety & Compliance.
 * Official RAS header mark from rasltd.ca (not invented).
 */
export function AppHeader() {
  const [navOpen, setNavOpen] = useState(false)
  const { session, role, signOut } = useAuth()

  return (
    <header
      className={`app-header${navOpen ? ' app-header--nav-open' : ''}`}
      role="banner"
    >
      <div className="app-header__row">
        <Link to="/" className="app-header__logo-link" onClick={() => setNavOpen(false)}>
          <img
            className="app-header__logo"
            src={rasLogo}
            alt="Ron Anderson & Sons"
            width={808}
            height={534}
          />
        </Link>
        <div className="app-header__wordmark">
          <span className="app-header__brand">RAS</span>
          <h1 className="app-header__product">SITESAFE</h1>
          <p className="app-header__tag">Site Safety &amp; Compliance</p>
        </div>
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
        <Link to="/" onClick={() => setNavOpen(false)}>
          Overview
        </Link>
        {session ? (
          <>
            <Link
              to={role === 'admin' ? '/admin' : '/framer'}
              onClick={() => setNavOpen(false)}
            >
              {role === 'admin' ? 'Admin' : 'Field'}
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
