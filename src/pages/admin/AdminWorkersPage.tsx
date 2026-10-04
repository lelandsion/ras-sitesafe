import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, FileWarning, LogOut, RefreshCw } from 'lucide-react'
import { AdminNav } from '../../components/admin/AdminNav'
import { AppHeader } from '../../components/layout/AppHeader'
import { useAuth } from '../../hooks/auth-context'
import {
  WORKER_TODAY_STATUS_LABELS,
  type WorkerRosterRow,
} from '../../lib/workerRoster'
import { loadWorkerRoster } from '../../services/workersService'

function statusPillClass(status: WorkerRosterRow['todayStatus']): string {
  if (status === 'submitted') return 'compliance-pill compliance-pill--submitted'
  if (status === 'missing') return 'compliance-pill compliance-pill--not_submitted'
  return 'compliance-pill compliance-pill--n_a'
}

export function AdminWorkersPage() {
  const { profile, signOut } = useAuth()
  const [rows, setRows] = useState<WorkerRosterRow[]>([])
  const [dateISO, setDateISO] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await loadWorkerRoster()
    if (result.error) {
      setError(result.error)
      setRows([])
    } else {
      setRows(result.rows)
      setDateISO(result.dateISO)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="admin-dash" aria-labelledby="admin-workers-title">
          <div className="admin-dash__head">
            <div>
              <p className="admin-dash__kicker">Admin</p>
              <h2 id="admin-workers-title" className="admin-dash__title">
                Workers
                <span>Framer roster &amp; today&apos;s check status</span>
              </h2>
              <p className="admin-dash__lead">
                Signed in as{' '}
                <strong>{profile?.display_name ?? 'Admin'}</strong>. Simple
                people roster — assignments and whether today&apos;s daily check
                is in
                {dateISO ? ` (${dateISO})` : ''}.
              </p>
              <AdminNav />
            </div>
            <div className="admin-dash__actions">
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw size={20} strokeWidth={2.5} aria-hidden />
                Refresh
              </button>
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => void signOut()}
              >
                <LogOut size={20} strokeWidth={2.5} aria-hidden />
                Sign out
              </button>
            </div>
          </div>

          {loading && (
            <div className="panel-state" role="status">
              Loading workers…
            </div>
          )}

          {!loading && error && (
            <div className="panel-state panel-state--error" role="alert">
              <FileWarning size={28} strokeWidth={2.25} aria-hidden />
              <p>{error}</p>
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => void load()}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="panel-state" role="status">
              <p>No framers found. Assign workers from Sites when accounts are ready.</p>
              <Link to="/admin/sites" className="btn btn--primary touch-target">
                Go to Sites
              </Link>
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="admin-panel">
              <h3 className="admin-panel__title">Framer roster</h3>
              <p className="admin-panel__lead">
                {rows.length} worker{rows.length === 1 ? '' : 's'} · Today&apos;s
                status uses the same assignment window as Daily Compliance.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table" aria-label="Workers">
                  <thead>
                    <tr>
                      <th scope="col">Worker</th>
                      <th scope="col">Sites</th>
                      <th scope="col">Today</th>
                      <th scope="col">Submissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.framerId}>
                        <td>
                          <span className="admin-row__site">{row.displayName}</span>
                        </td>
                        <td>
                          {row.siteNames.length === 0
                            ? 'Unassigned'
                            : row.siteNames.join(', ')}
                        </td>
                        <td>
                          <span className={statusPillClass(row.todayStatus)}>
                            {WORKER_TODAY_STATUS_LABELS[row.todayStatus]}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/admin?worker=${encodeURIComponent(row.framerId)}#submissions`}
                            className="btn btn--ghost touch-target admin-table__pdf"
                          >
                            <ClipboardList
                              size={18}
                              strokeWidth={2.25}
                              aria-hidden
                            />
                            Submissions
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Admin · Workers
      </footer>
    </div>
  )
}
