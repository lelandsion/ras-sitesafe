import './App.css'
import { AppHeader } from './components/layout/AppHeader'

function App() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="app-main__panel" aria-labelledby="foundation-heading">
          <h2 id="foundation-heading">Foundation ready</h2>
          <p>
            Mobile-first construction safety forms and compliance dashboard for
            Ron Anderson &amp; Sons. Auth, schema, and forms come next — see the
            foundation plan.
          </p>
          <ul className="status-list">
            <li>Official RAS logo + brand colors wired into the shell</li>
            <li>Vite + React + TypeScript scaffold</li>
            <li>Supabase client stub (publishable key via env)</li>
            <li>Folder layout for admin / framer flows</li>
          </ul>
          <a className="app-main__cta touch-target" href="#foundation-heading">
            Continue setup
          </a>
        </section>
      </main>
    </div>
  )
}

export default App
