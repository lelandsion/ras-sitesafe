import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import rasLogo from '../../assets/branding/ras-logo-no-text.png'

/**
 * Branded app shell header — RAS / SITESAFE / Site Safety & Compliance.
 * Official RAS header mark from rasltd.ca (not invented).
 */
export function AppHeader() {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <header
      className={`app-header${navOpen ? ' app-header--nav-open' : ''}`}
      role="banner"
    >
      <div className="app-header__row">
        <img
          className="app-header__logo"
          src={rasLogo}
          alt="Ron Anderson & Sons"
          width={808}
          height={534}
        />
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
        <a href="#sign-in" onClick={() => setNavOpen(false)}>
          Sign in
        </a>
        <a href="#overview" onClick={() => setNavOpen(false)}>
          Overview
        </a>
      </nav>
    </header>
  )
}
