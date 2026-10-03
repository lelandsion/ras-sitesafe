import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileWarning,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { AdminNav } from '../../components/admin/AdminNav'
import { CorrectiveActionModal } from '../../components/admin/CorrectiveActionModal'
import { AppHeader } from '../../components/layout/AppHeader'
import { useAuth } from '../../hooks/auth-context'
import {
  createCorrectiveAction,
  resolveCorrectiveAction,
  setCorrectiveActionStatus,
} from '../../services/correctiveActionsService'
import { listAdminSafetyIssues } from '../../services/safetyIssuesService'
import type {
  CorrectiveActionPriority,
  CorrectiveActionStatus,
  SafetyIssueWithDetails,
} from '../../types/correctiveActions'
import {
  CA_PRIORITY_LABELS,
  CA_STATUS_LABELS,
  ISSUE_SEVERITY_LABELS,
} from '../../types/correctiveActions'
import { issueKindFromChecklistKey } from '../../lib/safetyIssueKeys'
import { IssueKindBadge } from '../../components/ui/IssueKindBadge'

type StatusFilter = 'all' | 'ready_for_review' | 'open' | 'in_progress' | 'resolved' | 'no_ca'

function matchesStatusFilter(
  issue: SafetyIssueWithDetails,
  filter: StatusFilter,
): boolean {
  if (filter === 'all') return true
  const ca = issue.corrective_action
  if (filter === 'no_ca') return !ca
  return ca?.status === filter
}

export function AdminSafetyIssuesPage() {
  const { profile, user, signOut } = useAuth()
  const [items, setItems] = useState<SafetyIssueWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [createIssue, setCreateIssue] = useState<SafetyIssueWithDetails | null>(
    null,
  )
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setActionError(null)
    const { data, error: listError } = await listAdminSafetyIssues()
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

  const readyCount = useMemo(
    () =>
      items.filter((i) => i.corrective_action?.status === 'ready_for_review')
        .length,
    [items],
  )

  const visibleItems = useMemo(() => {
    const filtered = items.filter((i) => matchesStatusFilter(i, statusFilter))
    // Surface ready-for-review first within the current filter.
    return [...filtered].sort((a, b) => {
      const aReady = a.corrective_action?.status === 'ready_for_review' ? 0 : 1
      const bReady = b.corrective_action?.status === 'ready_for_review' ? 0 : 1
      if (aReady !== bReady) return aReady - bReady
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    })
  }, [items, statusFilter])

  async function onCreate(input: {
    required_action: string
    priority: CorrectiveActionPriority
    due_date: string | null
  }) {
    if (!user?.id || !createIssue) return
    setCreateSaving(true)
    setCreateError(null)
    const { error: createErr } = await createCorrectiveAction({
      safety_issue_id: createIssue.id,
      required_action: input.required_action,
      priority: input.priority,
      due_date: input.due_date,
      created_by: user.id,
    })
    setCreateSaving(false)
    if (createErr) {
      setCreateError(createErr)
      return
    }
    setCreateIssue(null)
    await load()
  }

  async function onMarkInProgress(caId: string) {
    setBusyId(caId)
    setActionError(null)
    const { error: err } = await setCorrectiveActionStatus({
      id: caId,
      status: 'in_progress',
    })
    setBusyId(null)
    if (err) {
      setActionError(err)
      return
    }
    await load()
  }

  async function onResolve(caId: string) {
    if (!user?.id) return
    const notes = resolveNotes[caId] ?? ''
    setBusyId(caId)
    setActionError(null)
    const { error: err } = await resolveCorrectiveAction({
      id: caId,
      resolution_notes: notes,
      resolved_by: user.id,
    })
    setBusyId(null)
    if (err) {
      setActionError(err)
      return
    }
    setResolveNotes((prev) => {
      const next = { ...prev }
      delete next[caId]
      return next
    })
    await load()
  }

  const filterOptions: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'ready_for_review', label: `Ready for review${readyCount ? ` (${readyCount})` : ''}` },
    { id: 'open', label: 'Open' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'no_ca', label: 'No CA' },
  ]

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="admin-dash" aria-labelledby="safety-issues-title">
          <div className="admin-dash__head">
            <div>
              <p className="admin-dash__kicker">RAS SiteSafe</p>
              <h2 id="safety-issues-title" className="admin-dash__title">
                Safety Issues
                <span>Field issues &amp; corrective actions</span>
              </h2>
              <p className="admin-dash__lead">
                Signed in as{' '}
                <strong>{profile?.display_name ?? 'Admin'}</strong>. Create a
                corrective action, wait for framer Ready for review, then
                Resolve with notes.
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
              Loading safety issues…
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

          {!loading && !error && actionError && (
            <p className="form-banner form-banner--error" role="alert">
              {actionError}
            </p>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="panel-state" role="status">
              <ShieldAlert size={28} strokeWidth={2.25} aria-hidden />
              <p>
                No safety issues yet. Framers create them when answering No or
                reporting a hazard / incident.
              </p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="admin-panel">
              <div
                className="safety-issue-filters"
                role="group"
                aria-label="Filter by corrective action status"
              >
                {filterOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={
                      statusFilter === opt.id
                        ? 'btn btn--primary touch-target safety-issue-filters__btn'
                        : 'btn btn--ghost touch-target safety-issue-filters__btn'
                    }
                    aria-pressed={statusFilter === opt.id}
                    onClick={() => setStatusFilter(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {visibleItems.length === 0 ? (
                <div className="panel-state panel-state--compact" role="status">
                  No issues match this filter.
                </div>
              ) : (
                <ul className="safety-issue-list">
                  {visibleItems.map((issue) => {
                    const ca = issue.corrective_action
                    const busy = busyId === ca?.id
                    const kind = issueKindFromChecklistKey(
                      issue.checklist_item_key,
                    )
                    const canResolve =
                      ca &&
                      (ca.status === 'open' ||
                        ca.status === 'in_progress' ||
                        ca.status === 'ready_for_review')
                    const canSendBack =
                      ca &&
                      (ca.status === 'open' ||
                        ca.status === 'ready_for_review')

                    return (
                      <li
                        key={issue.id}
                        className={
                          ca?.status === 'ready_for_review'
                            ? 'safety-issue-card safety-issue-card--ready'
                            : 'safety-issue-card'
                        }
                      >
                        <div className="safety-issue-card__top">
                          <div className="safety-issue-card__main">
                            <p className="safety-issue-card__site">
                              {issue.submission?.sites?.name ?? 'Unknown site'}
                            </p>
                            <p className="safety-issue-card__item">
                              {issue.item_label}
                            </p>
                            <p className="safety-issue-card__desc">
                              {issue.description}
                            </p>
                            <p className="safety-issue-card__meta">
                              {issue.submission?.submitter?.display_name ??
                                'Worker'}
                              {issue.immediate_action.trim()
                                ? ` · Immediate: ${issue.immediate_action}`
                                : null}
                            </p>
                          </div>
                          <div className="safety-issue-card__badges">
                            <IssueKindBadge kind={kind} />
                            <span
                              className={`severity-badge severity-badge--${issue.severity}`}
                            >
                              {ISSUE_SEVERITY_LABELS[issue.severity]}
                            </span>
                            {ca ? (
                              <span
                                className={`ca-status-badge ca-status-badge--${ca.status as CorrectiveActionStatus}`}
                                data-testid={
                                  ca.status === 'ready_for_review'
                                    ? `ca-ready-badge-${ca.id}`
                                    : undefined
                                }
                              >
                                {CA_STATUS_LABELS[ca.status]}
                              </span>
                            ) : (
                              <span className="ca-status-badge ca-status-badge--none">
                                No CA
                              </span>
                            )}
                          </div>
                        </div>

                        {ca && (
                          <div className="safety-issue-card__ca">
                            <p className="safety-issue-card__ca-action">
                              <strong>Required:</strong> {ca.required_action}
                            </p>
                            <p className="safety-issue-card__ca-meta">
                              {CA_PRIORITY_LABELS[ca.priority]} priority
                              {ca.due_date ? ` · Due ${ca.due_date}` : ''}
                            </p>
                            {ca.status === 'ready_for_review' && (
                              <p className="safety-issue-card__awaiting">
                                Framer marked complete — awaiting your formal
                                resolve.
                              </p>
                            )}
                            {ca.framer_completion_notes?.trim() && (
                              <p className="safety-issue-card__framer-note">
                                <strong>Framer note:</strong>{' '}
                                {ca.framer_completion_notes}
                              </p>
                            )}
                            {ca.status === 'resolved' && ca.resolution_notes && (
                              <p className="safety-issue-card__resolution">
                                <strong>Resolution:</strong>{' '}
                                {ca.resolution_notes}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="safety-issue-card__actions">
                          {issue.submission_id && (
                            <Link
                              to={`/admin/submissions/${issue.submission_id}`}
                              className="btn btn--ghost touch-target"
                            >
                              View submission
                            </Link>
                          )}
                          {!ca && (
                            <button
                              type="button"
                              className="btn btn--primary touch-target"
                              onClick={() => setCreateIssue(issue)}
                            >
                              Create CA
                            </button>
                          )}
                          {canSendBack && (
                            <button
                              type="button"
                              className="btn btn--primary touch-target"
                              disabled={busy}
                              onClick={() => void onMarkInProgress(ca.id)}
                            >
                              {ca.status === 'ready_for_review'
                                ? 'Send back (in progress)'
                                : 'Mark in progress'}
                            </button>
                          )}
                        </div>

                        {canResolve && (
                          <div className="ca-resolve">
                            <label className="field">
                              <span className="field__label">
                                Resolution notes *
                              </span>
                              <textarea
                                className="field__input ca-modal__textarea"
                                rows={2}
                                disabled={busy}
                                value={resolveNotes[ca.id] ?? ''}
                                onChange={(e) =>
                                  setResolveNotes((prev) => ({
                                    ...prev,
                                    [ca.id]: e.target.value,
                                  }))
                                }
                                placeholder="How was this closed?"
                              />
                            </label>
                            <button
                              type="button"
                              className="btn btn--primary touch-target"
                              disabled={busy}
                              onClick={() => void onResolve(ca.id)}
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Safety Issues
      </footer>

      <CorrectiveActionModal
        open={createIssue !== null}
        issue={createIssue}
        saving={createSaving}
        error={createError}
        onClose={() => {
          if (createSaving) return
          setCreateIssue(null)
          setCreateError(null)
        }}
        onCreate={(input) => void onCreate(input)}
      />
    </div>
  )
}
