import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardPlus,
  FileWarning,
  LogOut,
  RefreshCw,
} from 'lucide-react'
import { AppHeader } from '../../components/layout/AppHeader'
import { CaAttentionBadge } from '../../components/ui/CaAttentionBadge'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../hooks/auth-context'
import { sortFramerSubmissions } from '../../lib/submissionAttention'
import { listMySubmissions } from '../../services/submissionsService'
import type { SubmissionWithSite } from '../../types/database'

function formatWhen(iso: string): string {
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

export function FramerHomePage() {
  const { profile, signOut } = useAuth()
  const [items, setItems] = useState<SubmissionWithSite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: listError } = await listMySubmissions()
    if (listError) {
      setError(listError)
      setItems([])
    } else {
      setItems(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sortedItems = useMemo(
    () => sortFramerSubmissions(items),
    [items],
  )

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="framer-home" aria-labelledby="framer-title">
          <div className="framer-home__head">
            <div>
              <p className="framer-home__kicker">Framer</p>
              <h2 id="framer-title" className="framer-home__title">
                Field safety
                <span>My submissions</span>
              </h2>
              <p className="framer-home__lead">
                Signed in as <strong>{profile?.display_name ?? 'Framer'}</strong>.
                Log a site check, attach photos, track review status.
              </p>
            </div>
            <div className="framer-home__actions">
              <Link
                className="btn btn--primary touch-target"
                to="/framer/new"
              >
                <ClipboardPlus size={20} strokeWidth={2.5} aria-hidden />
                New report
              </Link>
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
              Loading submissions…
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

          {!loading && !error && items.length === 0 && (
            <div className="panel-state" role="status">
              <p>No safety reports yet.</p>
              <Link className="btn btn--primary touch-target" to="/framer/new">
                <ClipboardPlus size={20} strokeWidth={2.5} aria-hidden />
                Start first report
              </Link>
            </div>
          )}

          {!loading && !error && sortedItems.length > 0 && (
            <ul className="submission-list" aria-label="Your submissions">
              {sortedItems.map((item) => (
                <li key={item.id}>
                  <Link
                    className="submission-card touch-target"
                    to={`/framer/submissions/${item.id}`}
                  >
                    <div className="submission-card__top">
                      <span className="submission-card__site">
                        {item.sites?.name ?? 'Unknown site'}
                      </span>
                      <div className="submission-card__badges">
                        <StatusBadge status={item.status} />
                        <CaAttentionBadge attention={item.caAttention} />
                      </div>
                    </div>
                    {item.sites?.address && (
                      <p className="submission-card__addr">{item.sites.address}</p>
                    )}
                    <p className="submission-card__notes">
                      {item.notes?.trim()
                        ? item.notes.trim()
                        : 'No notes yet'}
                    </p>
                    <p className="submission-card__meta">
                      Updated {formatWhen(item.updated_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Framer
      </footer>
    </div>
  )
}
