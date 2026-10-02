import rasLogo from '../../assets/branding/ras-logo-no-text.png'

/**
 * Branded app shell header — RAS / SITESAFE / Site Safety & Compliance.
 * Uses the official RAS header mark from rasltd.ca (not invented).
 */
export function AppHeader() {
  return (
    <header className="app-header" role="banner">
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
      </div>
    </header>
  )
}
