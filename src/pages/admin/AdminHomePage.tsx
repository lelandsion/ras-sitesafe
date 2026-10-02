import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  FileWarning,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { SubmissionsStatusChart } from '../../components/admin/SubmissionsStatusChart'
import { AppHeader } from '../../components/layout/AppHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../hooks/auth-context'
import {
  listAdminSubmissions,
  reviewSubmission,
} from '../../services/submissionsService'
import type {
  SubmissionStatus,
  SubmissionWithDetails,
} from '../../types/database'
import {
  ADMIN_REVIEW_STATUSES,
  SUBMISSION_STATUS_LABELS,
} from '../../types/database'

type FilterKey = 'all' | 'queue' | 'approved' | 'rejected'

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function inReviewQueue(status: SubmissionStatus): boolean {
  return status === 'submitted' || status === 'under_review'
}

export function AdminHomePage() {
  const { profile, user, signOut } = useAuth()
  const [items, setItems] = useState<SubmissionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setActionError(null)
    const { data, error: listError } = await listAdminSubmissions()
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

  const counts = useMemo(() => {
    const total = items.length
    const queue = items.filter((i) => inReviewQueue(i.status)).length
    const approved = items.filter((i) => i.status === 'approved').length
    const rejected = items.filter((i) => i.status === 'rejected').length
    return { total, queue, approved, rejected }
  }, [items])

  const filtered = useMemo(() => {
    switch (filter) {
      case 'queue':
        return items.filter((i) => inReviewQueue(i.status))
      case 'approved':
        return items.filter((i) => i.status === 'approved')
      case 'rejected':
        return items.filter((i) => i.status === 'rejected')
      default:
        return items
    }
  }, [items, filter])

  async function onReview(
    submissionId: string,
    status: Extract<
      SubmissionStatus,
      'under_review' | 'approved' | 'rejected'
    >,
  ) {
    if (!user?.id) return
    setUpdatingId(submissionId)
    setActionError(null)
    const { data, error: reviewError } = await reviewSubmission(
      submissionId,
      status,
      user.id,
    )
    if (reviewError || !data) {
      setActionError(reviewError ?? 'Could not update status.')
      setUpdatingId(null)
      return
    }
    setItems((prev) =>
      prev.map((row) =>
        row.id === submissionId
          ? {
              ...row,
              status: data.status,
              reviewed_by: data.reviewed_by,
              reviewed_at: data.reviewed_at,
              updated_at: data.updated_at,
            }
          : row,
      ),
    )
    setUpdatingId(null)
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="admin-dash" aria-labelledby="admin-title">
          <div className="admin-dash__head">
            <div>
              <p className="admin-dash__kicker">Admin</p>
              <h2 id="admin-title" className="admin-dash__title">
                Compliance desk
                <span>Review field safety reports</span>
              </h2>
              <p className="admin-dash__lead">
                Signed in as{' '}
                <strong>{profile?.display_name ?? 'Admin'}</strong>. Queue
                submissions for review, approve clear reports, or send issues
                back.
              </p>
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

          {!loading && !error && (
            <div className="admin-metrics" aria-label="Submission summary">
              <div className="admin-metrics__item">
                <ClipboardList size={22} strokeWidth={2.25} aria-hidden />
                <div>
                  <p className="admin-metrics__value">{counts.total}</p>
                  <p className="admin-metrics__label">Total</p>
                </div>
              </div>
              <div className="admin-metrics__item admin-metrics__item--warn">
                <ShieldAlert size={22} strokeWidth={2.25} aria-hidden />
                <div>
                  <p className="admin-metrics__value">{counts.queue}</p>
                  <p className="admin-metrics__label">Needs review</p>
                </div>
              </div>
              <div className="admin-metrics__item admin-metrics__item--ok">
                <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden />
                <div>
                  <p className="admin-metrics__value">{counts.approved}</p>
                  <p className="admin-metrics__label">Approved</p>
                </div>
              </div>
              <div className="admin-metrics__item admin-metrics__item--danger">
                <FileWarning size={22} strokeWidth={2.25} aria-hidden />
                <div>
                  <p className="admin-metrics__value">{counts.rejected}</p>
                  <p className="admin-metrics__label">Rejected</p>
                </div>
              </div>
            </div>
          )}

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

          {!loading && !error && (
            <>
              <div className="admin-chart-panel">
                <h3 className="admin-chart-panel__title">By status</h3>
                <p className="admin-chart-panel__lead">
                  Live count of every safety report in the system.
                </p>
                <SubmissionsStatusChart
                  statuses={items.map((i) => i.status)}
                />
              </div>

              {actionError && (
                <p className="form-banner form-banner--error" role="alert">
                  {actionError}
                </p>
              )}

              <div
                className="admin-filters"
                role="tablist"
                aria-label="Filter submissions"
              >
                {(
                  [
                    ['all', `All (${counts.total})`],
                    ['queue', `Needs review (${counts.queue})`],
                    ['approved', `Approved (${counts.approved})`],
                    ['rejected', `Rejected (${counts.rejected})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={filter === key}
                    className={
                      filter === key
                        ? 'admin-filters__btn admin-filters__btn--active touch-target'
                        : 'admin-filters__btn touch-target'
                    }
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="panel-state" role="status">
                  <p>
                    {items.length === 0
                      ? 'No safety reports yet. Framers submit from the field.'
                      : 'Nothing in this filter.'}
                  </p>
                </div>
              ) : (
                <ul className="admin-list" aria-label="Submissions to review">
                  {filtered.map((item) => {
                    const canReview = item.status !== 'draft'
                    const busy = updatingId === item.id
                    return (
                      <li key={item.id} className="admin-row">
                        <div className="admin-row__main">
                          <div className="admin-row__top">
                            <span className="admin-row__site">
                              {item.sites?.name ?? 'Unknown site'}
                            </span>
                            <StatusBadge status={item.status} />
                          </div>
                          {item.sites?.address && (
                            <p className="admin-row__addr">
                              {item.sites.address}
                            </p>
                          )}
                          <p className="admin-row__meta">
                            {item.submitter?.display_name ?? 'Unknown framer'}
                            {' · '}
                            Updated {formatWhen(item.updated_at)}
                            {item.reviewed_at
                              ? ` · Reviewed ${formatWhen(item.reviewed_at)}`
                              : ''}
                          </p>
                          <p className="admin-row__notes">
                            {item.notes?.trim()
                              ? item.notes.trim()
                              : 'No notes'}
                          </p>
                        </div>
                        {canReview ? (
                          <div className="admin-row__actions">
                            <label className="admin-row__status-field">
                              <span>Set status</span>
                              <select
                                className="admin-row__select touch-target"
                                defaultValue=""
                                key={`${item.id}-${item.status}`}
                                disabled={busy}
                                onChange={(e) => {
                                  const next = e.target.value
                                  if (
                                    next !== 'under_review' &&
                                    next !== 'approved' &&
                                    next !== 'rejected'
                                  ) {
                                    return
                                  }
                                  void onReview(item.id, next)
                                }}
                                aria-label={`Update status for ${item.sites?.name ?? 'submission'}`}
                              >
                                <option value="" disabled>
                                  Choose…
                                </option>
                                {ADMIN_REVIEW_STATUSES.map((s) => (
                                  <option
                                    key={s}
                                    value={s}
                                    disabled={s === item.status}
                                  >
                                    {SUBMISSION_STATUS_LABELS[s]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="admin-row__quick">
                              {item.status === 'submitted' && (
                                <button
                                  type="button"
                                  className="btn btn--ghost touch-target"
                                  disabled={busy}
                                  onClick={() =>
                                    void onReview(item.id, 'under_review')
                                  }
                                >
                                  Start review
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn--primary touch-target"
                                disabled={busy || item.status === 'approved'}
                                onClick={() =>
                                  void onReview(item.id, 'approved')
                                }
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn--danger-ghost touch-target"
                                disabled={busy || item.status === 'rejected'}
                                onClick={() =>
                                  void onReview(item.id, 'rejected')
                                }
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="admin-row__draft-note">
                            Draft — waiting for framer to submit.
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Admin
      </footer>
    </div>
  )
}
