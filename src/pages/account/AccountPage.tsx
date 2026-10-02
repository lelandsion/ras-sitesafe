import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/layout/AppHeader'
import { useAuth } from '../../hooks/auth-context'
import { loadAccountSummary } from '../../services/accountService'
import type { AccountSummary } from '../../services/accountService'
import type { UserRole } from '../../types/database'

function roleLabel(role: UserRole): string {
  return role === 'admin' ? 'Admin' : 'Framer'
}

function formatLastSubmission(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function AccountPage() {
  const { user, profile, role } = useAuth()
  const [summary, setSummary] = useState<AccountSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!role) return
    setLoading(true)
    setError(null)
    const result = await loadAccountSummary(role)
    if (result.error) {
      setError(result.error)
      setSummary(null)
    } else {
      setSummary(result.data)
    }
    setLoading(false)
  }, [role])

  useEffect(() => {
    void load()
  }, [load])

  const home = role === 'admin' ? '/admin' : '/framer'
  const displayName = profile?.display_name ?? 'User'
  const email = user?.email ?? '—'

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="account-page" aria-labelledby="account-title">
          <Link to={home} className="form-page__back touch-target">
            ← Back
          </Link>

          <header className="account-page__hero">
            <h2 id="account-title" className="account-page__name">
              {displayName}
            </h2>
            <p className="account-page__role">{role ? roleLabel(role) : '—'}</p>
            <p className="account-page__email">{email}</p>
          </header>

          {loading && (
            <div className="panel-state" role="status">
              Loading account…
            </div>
          )}

          {!loading && error && (
            <p className="form-banner form-banner--error" role="alert">
              {error}
            </p>
          )}

          {!loading && !error && summary && (
            <>
              <section className="account-block" aria-labelledby="work-heading">
                <h3 id="work-heading" className="account-block__title">
                  Work
                </h3>
                <p className="account-block__subtitle">{summary.sitesHeading}</p>
                {summary.sites.length === 0 ? (
                  <p className="account-block__empty">No sites assigned yet.</p>
                ) : (
                  <ul className="account-list">
                    {summary.sites.map((site) => (
                      <li key={site.id}>• {site.name}</li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="account-block" aria-labelledby="activity-heading">
                <h3 id="activity-heading" className="account-block__title">
                  Safety activity
                </h3>
                <dl className="account-kv">
                  <div>
                    <dt>Safety checks submitted</dt>
                    <dd>{summary.activity.checksSubmitted}</dd>
                  </div>
                  <div>
                    <dt>This month</dt>
                    <dd>{summary.activity.thisMonth}</dd>
                  </div>
                  <div>
                    <dt>Last submission</dt>
                    <dd>{formatLastSubmission(summary.activity.lastSubmissionAt)}</dd>
                  </div>
                </dl>
              </section>

              <section className="account-block" aria-labelledby="acct-heading">
                <h3 id="acct-heading" className="account-block__title">
                  Account
                </h3>
                <dl className="account-kv">
                  <div>
                    <dt>Email</dt>
                    <dd>{email}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{role ? roleLabel(role) : '—'}</dd>
                  </div>
                </dl>
              </section>
            </>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Account
      </footer>
    </div>
  )
}
