import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileWarning,
  LogOut,
  RefreshCw,
} from 'lucide-react'
import { AdminNav } from '../../components/admin/AdminNav'
import { AppHeader } from '../../components/layout/AppHeader'
import { useAuth } from '../../hooks/auth-context'
import {
  filterComplianceRows,
  localDateISO,
  shiftDateISO,
  type ComplianceFilter,
  COMPLIANCE_STATUS_LABELS,
} from '../../lib/dailyCompliance'
import { loadSiteDailyCompliance } from '../../services/complianceService'
import { listAdminSites } from '../../services/sitesService'
import type { ComplianceSummary, ComplianceWorkerRow } from '../../lib/dailyCompliance'

const FILTERS: { id: ComplianceFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'missing', label: 'Missing' },
  { id: 'issues', label: 'Issues' },
]

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function AdminDailyCompliancePage() {
  const { siteId = '' } = useParams<{ siteId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile, signOut } = useAuth()

  const dateISO = searchParams.get('date') || localDateISO()
  const filter = (searchParams.get('filter') as ComplianceFilter) || 'all'

  const [siteName, setSiteName] = useState('')
  const [rows, setRows] = useState<ComplianceWorkerRow[]>([])
  const [summary, setSummary] = useState<ComplianceSummary>({
    assigned: 0,
    submitted: 0,
    missing: 0,
    issues: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ComplianceWorkerRow | null>(null)

  const load = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    setError(null)

    const sitesResult = await listAdminSites()
    if (!sitesResult.error) {
      const site = sitesResult.data.find((s) => s.id === siteId)
      setSiteName(site?.name ?? 'Site')
    }

    const result = await loadSiteDailyCompliance({ siteId, dateISO })
    if (result.error) {
      setError(result.error)
      setRows([])
      setSummary({ assigned: 0, submitted: 0, missing: 0, issues: 0 })
    } else {
      setRows(result.rows)
      setSummary(result.summary)
    }
    setLoading(false)
  }, [siteId, dateISO])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setSelected(null)
  }, [dateISO, filter, siteId])

  const visible = useMemo(
    () => filterComplianceRows(rows, filter),
    [rows, filter],
  )

  function setDate(next: string) {
    const params = new URLSearchParams(searchParams)
    params.set('date', next)
    setSearchParams(params, { replace: true })
  }

  function setFilter(next: ComplianceFilter) {
    const params = new URLSearchParams(searchParams)
    if (next === 'all') params.delete('filter')
    else params.set('filter', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="admin-dash" aria-labelledby="compliance-title">
          <div className="admin-dash__head">
            <div>
              <Link
                to="/admin/sites"
                className="form-page__back touch-target"
              >
                <ArrowLeft size={18} strokeWidth={2.5} aria-hidden />
                Sites
              </Link>
              <p className="admin-dash__kicker">Sites · Daily Compliance</p>
              <h2 id="compliance-title" className="admin-dash__title">
                {siteName || 'Daily Compliance'}
                <span>Crew status for a selected date</span>
              </h2>
              <p className="admin-dash__lead">
                Signed in as{' '}
                <strong>{profile?.display_name ?? 'Admin'}</strong>. Missing =
                assigned that day with no submission. Not assigned ≠ Missing.
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

          <div className="compliance-datebar">
            <button
              type="button"
              className="btn btn--ghost touch-target"
              aria-label="Previous day"
              onClick={() => setDate(shiftDateISO(dateISO, -1))}
            >
              <ChevronLeft size={20} strokeWidth={2.5} aria-hidden />
            </button>
            <label className="compliance-datebar__picker">
              <span className="visually-hidden">Date</span>
              <input
                type="date"
                className="safety-form__control touch-target"
                value={dateISO}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn--ghost touch-target"
              aria-label="Next day"
              onClick={() => setDate(shiftDateISO(dateISO, 1))}
            >
              <ChevronRight size={20} strokeWidth={2.5} aria-hidden />
            </button>
            {dateISO !== localDateISO() && (
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => setDate(localDateISO())}
              >
                Today
              </button>
            )}
          </div>

          <div className="compliance-summary" aria-label="Compliance summary">
            <div className="compliance-summary__cell">
              <span className="compliance-summary__n">{summary.assigned}</span>
              <span className="compliance-summary__l">Assigned</span>
            </div>
            <div className="compliance-summary__cell">
              <span className="compliance-summary__n">{summary.submitted}</span>
              <span className="compliance-summary__l">Submitted</span>
            </div>
            <div className="compliance-summary__cell compliance-summary__cell--warn">
              <span className="compliance-summary__n">{summary.missing}</span>
              <span className="compliance-summary__l">Missing</span>
            </div>
            <div className="compliance-summary__cell compliance-summary__cell--alert">
              <span className="compliance-summary__n">{summary.issues}</span>
              <span className="compliance-summary__l">Issues</span>
            </div>
          </div>

          <div className="compliance-tabs" role="tablist" aria-label="Filter crew">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={
                  filter === f.id
                    ? 'compliance-tabs__btn compliance-tabs__btn--active touch-target'
                    : 'compliance-tabs__btn touch-target'
                }
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="panel-state" role="status">
              Loading crew status…
            </div>
          )}

          {!loading && error && (
            <div className="panel-state panel-state--error" role="alert">
              <FileWarning size={28} strokeWidth={2.25} aria-hidden />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="compliance-layout">
              <div className="admin-panel">
                {visible.length === 0 ? (
                  <p className="admin-panel__empty">
                    No workers in this filter for {dateISO}.
                  </p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th scope="col">Worker</th>
                          <th scope="col">Status</th>
                          <th scope="col">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((row) => (
                          <tr
                            key={row.framerId}
                            className={
                              selected?.framerId === row.framerId
                                ? 'admin-table__row--selected admin-table__row--clickable'
                                : 'admin-table__row--clickable'
                            }
                            onClick={() => setSelected(row)}
                          >
                            <td>
                              <strong>{row.displayName}</strong>
                            </td>
                            <td>
                              <span
                                className={`compliance-pill compliance-pill--${row.status}`}
                              >
                                {COMPLIANCE_STATUS_LABELS[row.status]}
                              </span>
                            </td>
                            <td>{formatTime(row.submittedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <aside className="admin-panel compliance-detail" aria-live="polite">
                {!selected && (
                  <p className="admin-panel__empty">
                    Select a worker to see details.
                  </p>
                )}
                {selected && selected.status === 'not_submitted' && (
                  <>
                    <h3 className="admin-panel__title">
                      {selected.displayName}
                    </h3>
                    <p className="compliance-detail__status">NOT SUBMITTED</p>
                    <p className="admin-panel__lead">
                      Assigned to this site on {dateISO}, but no daily safety
                      check was filed for this site/date.
                    </p>
                    <p className="admin-panel__lead">
                      Messaging / reminders are not available yet.
                    </p>
                    <Link
                      to="/admin/sites"
                      className="btn btn--ghost touch-target"
                    >
                      View Worker
                    </Link>
                    <p className="admin-table__note">
                      Worker directory messaging comes later — use Sites →
                      Assign workers for now.
                    </p>
                  </>
                )}
                {selected && selected.status !== 'not_submitted' && (
                  <>
                    <h3 className="admin-panel__title">
                      {selected.displayName}
                    </h3>
                    <p className="compliance-detail__status">
                      {COMPLIANCE_STATUS_LABELS[selected.status]}
                      {selected.issueCount > 0
                        ? ` · ${selected.issueCount} issue${selected.issueCount === 1 ? '' : 's'}`
                        : ''}
                    </p>
                    <p className="admin-panel__lead">
                      Submitted {formatTime(selected.submittedAt)} on {dateISO}.
                    </p>
                    {selected.submissionId && (
                      <Link
                        to={`/admin/submissions/${selected.submissionId}/preview`}
                        className="btn btn--primary touch-target"
                      >
                        View Submission
                      </Link>
                    )}
                  </>
                )}
              </aside>
            </div>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Daily Compliance
      </footer>
    </div>
  )
}
