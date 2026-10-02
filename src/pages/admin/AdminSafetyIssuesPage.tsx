import { useCallback, useEffect, useState } from 'react'
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
  SafetyIssueWithDetails,
} from '../../types/correctiveActions'
import {
  CA_PRIORITY_LABELS,
  CA_STATUS_LABELS,
  ISSUE_SEVERITY_LABELS,
} from '../../types/correctiveActions'

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
                corrective action, move it In Progress, then Resolve with notes.
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
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Site</th>
                      <th scope="col">Worker</th>
                      <th scope="col">Item</th>
                      <th scope="col">Severity</th>
                      <th scope="col">CA status</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((issue) => {
                      const ca = issue.corrective_action
                      const busy = busyId === ca?.id
                      return (
                        <tr key={issue.id}>
                          <td>
                            <strong>
                              {issue.submission?.sites?.name ?? '—'}
                            </strong>
                            <p className="admin-table__note">
                              {issue.description}
                            </p>
                          </td>
                          <td>
                            {issue.submission?.submitter?.display_name ?? '—'}
                          </td>
                          <td>{issue.item_label}</td>
                          <td>
                            <span
                              className={`severity-badge severity-badge--${issue.severity}`}
                            >
                              {ISSUE_SEVERITY_LABELS[issue.severity]}
                            </span>
                          </td>
                          <td>
                            {ca ? (
                              <span
                                className={`ca-status-badge ca-status-badge--${ca.status}`}
                              >
                                {CA_STATUS_LABELS[ca.status]}
                              </span>
                            ) : (
                              <span className="ca-status-badge ca-status-badge--none">
                                None
                              </span>
                            )}
                          </td>
                          <td>
                            {ca ? CA_PRIORITY_LABELS[ca.priority] : '—'}
                          </td>
                          <td>
                            <div className="admin-table__actions">
                              {issue.submission_id && (
                                <Link
                                  to={`/admin/submissions/${issue.submission_id}/preview`}
                                  className="btn btn--ghost touch-target admin-table__pdf"
                                >
                                  View submission
                                </Link>
                              )}
                              {!ca && (
                                <button
                                  type="button"
                                  className="btn btn--primary touch-target admin-table__pdf"
                                  onClick={() => setCreateIssue(issue)}
                                >
                                  Create CA
                                </button>
                              )}
                              {ca && ca.status === 'open' && (
                                <button
                                  type="button"
                                  className="btn btn--primary touch-target admin-table__pdf"
                                  disabled={busy}
                                  onClick={() => void onMarkInProgress(ca.id)}
                                >
                                  Mark in progress
                                </button>
                              )}
                              {ca &&
                                (ca.status === 'open' ||
                                  ca.status === 'in_progress') && (
                                  <div className="ca-resolve">
                                    <label className="safety-form__field">
                                      <span>Resolution notes *</span>
                                      <textarea
                                        className="safety-form__control safety-form__textarea"
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
                                      className="btn btn--primary touch-target admin-table__pdf"
                                      disabled={busy}
                                      onClick={() => void onResolve(ca.id)}
                                    >
                                      Resolve
                                    </button>
                                  </div>
                                )}
                              {ca?.status === 'resolved' &&
                                ca.resolution_notes && (
                                  <p className="admin-table__note">
                                    {ca.resolution_notes}
                                  </p>
                                )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
