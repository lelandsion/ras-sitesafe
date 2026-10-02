import { LogIn, ShieldCheck } from 'lucide-react'
import './App.css'
import { AppHeader } from './components/layout/AppHeader'

function App() {
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
            <a className="btn btn--primary touch-target" id="sign-in" href="#sign-in">
              <LogIn size={20} strokeWidth={2.5} aria-hidden />
              Sign in
            </a>
            <a className="btn btn--ghost touch-target" href="#overview">
              <ShieldCheck size={20} strokeWidth={2.5} aria-hidden />
              How it works
            </a>
          </div>
          <p className="hero__meta">
            <strong>Foundation ready.</strong> Auth, roles, and safety forms land
            next — this shell carries the RAS brand into the product.
          </p>
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Internal construction safety tool
      </footer>
    </div>
  )
}

export default App
