import './App.css'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header__brand">RAS</span>
        <h1 className="app-header__product">SITESAFE</h1>
        <p className="app-header__tag">Site Safety &amp; Compliance</p>
      </header>
      <main className="app-main">
        <h2>Foundation ready</h2>
        <p>
          Mobile-first construction safety forms and compliance dashboard for
          Ron Anderson &amp; Sons. Auth, schema, and forms come next — see the
          foundation plan.
        </p>
        <ul className="status-list">
          <li>Vite + React + TypeScript scaffold</li>
          <li>Supabase client stub (env keys pending)</li>
          <li>Folder layout for admin / framer flows</li>
        </ul>
      </main>
    </div>
  )
}

export default App
