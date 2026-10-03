import { useState } from 'react'
import type { SafetyIssueWithDetails } from '../../types/correctiveActions'
import {
  CA_PRIORITY_LABELS,
  CA_STATUS_LABELS,
  ISSUE_SEVERITY_LABELS,
} from '../../types/correctiveActions'
import { issueKindFromChecklistKey } from '../../lib/safetyIssueKeys'
import { markCorrectiveActionReadyForReview } from '../../services/correctiveActionsService'
import { IssueKindBadge } from '../ui/IssueKindBadge'

type Props = {
  issues: SafetyIssueWithDetails[]
  loading?: boolean
  /** When true, framer can mark open/in_progress CAs ready for review. */
  allowMarkComplete?: boolean
  onChanged?: () => void
}

export function SubmissionIssuesPanel({
  issues,
  loading,
  allowMarkComplete = false,
  onChanged,
}: Props) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function onMarkReady(caId: string) {
    setBusyId(caId)
    setActionError(null)
    const { error } = await markCorrectiveActionReadyForReview({
      id: caId,
      completion_notes: notes[caId] ?? '',
    })
    setBusyId(null)
    if (error) {
      setActionError(error)
      return
    }
    setNotes((prev) => {
      const next = { ...prev }
      delete next[caId]
      return next
    })
    onChanged?.()
  }

  if (loading) {
    return (
      <section className="check-section" aria-labelledby="safety-issues-ro">
        <h3 id="safety-issues-ro" className="check-section__title">
          Safety issues
        </h3>
        <div className="panel-state panel-state--compact" role="status">
          Loading issues…
        </div>
      </section>
    )
  }

  if (issues.length === 0) return null

  return (
    <section
      className="check-section"
      aria-labelledby="safety-issues-ro"
      data-testid="submission-issues-panel"
    >
      <h3 id="safety-issues-ro" className="check-section__title">
        Safety issues
      </h3>
      <p className="check-section__lead">
        Your reported issues and any office corrective actions / resolutions.
      </p>
      {actionError && (
        <p className="form-banner form-banner--error" role="alert">
          {actionError}
        </p>
      )}
      <ul className="issue-outcome-list">
        {issues.map((issue) => {
          const ca = issue.corrective_action
          const canMark =
            allowMarkComplete &&
            ca &&
            (ca.status === 'open' || ca.status === 'in_progress')
          const awaitingReview = ca?.status === 'ready_for_review'

          return (
            <li key={issue.id} className="issue-outcome">
              <div className="issue-outcome__head">
                <h4 className="issue-outcome__title">{issue.item_label}</h4>
                <div className="issue-outcome__badges">
                  <IssueKindBadge
                    kind={issueKindFromChecklistKey(issue.checklist_item_key)}
                  />
                  <span
                    className={`severity-badge severity-badge--${issue.severity}`}
                  >
                    {ISSUE_SEVERITY_LABELS[issue.severity]}
                  </span>
                </div>
              </div>
              <p className="issue-outcome__desc">{issue.description}</p>
              {issue.immediate_action.trim() && (
                <p className="issue-outcome__immediate">
                  <strong>Immediate action:</strong> {issue.immediate_action}
                </p>
              )}
              {ca ? (
                <div className="issue-outcome__ca">
                  <div className="issue-outcome__ca-head">
                    <span
                      className={`ca-status-badge ca-status-badge--${ca.status}`}
                    >
                      {CA_STATUS_LABELS[ca.status]}
                    </span>
                    <span className="issue-outcome__priority">
                      {CA_PRIORITY_LABELS[ca.priority]} priority
                    </span>
                  </div>
                  <p className="issue-outcome__action">
                    <strong>{ca.required_action}</strong>
                  </p>
                  {awaitingReview && (
                    <p
                      className="issue-outcome__awaiting"
                      data-testid={`ca-awaiting-review-${ca.id}`}
                    >
                      Awaiting admin review — office still needs to formally
                      resolve.
                    </p>
                  )}
                  {ca.framer_completion_notes?.trim() && (
                    <p className="issue-outcome__framer-note">
                      <strong>Your note:</strong> {ca.framer_completion_notes}
                    </p>
                  )}
                  {ca.status === 'resolved' && ca.resolution_notes && (
                    <>
                      <hr className="issue-outcome__rule" />
                      <p className="issue-outcome__resolution-label">
                        Resolution
                      </p>
                      <p className="issue-outcome__resolution">
                        {ca.resolution_notes}
                      </p>
                    </>
                  )}
                  {canMark && (
                    <div
                      className="issue-outcome__mark"
                      data-testid={`ca-mark-complete-${ca.id}`}
                    >
                      <label className="field">
                        <span className="field__label">
                          Completion note (optional)
                        </span>
                        <textarea
                          className="field__input ca-modal__textarea"
                          rows={2}
                          disabled={busyId === ca.id}
                          value={notes[ca.id] ?? ''}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [ca.id]: e.target.value,
                            }))
                          }
                          placeholder="What did you do to complete this?"
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn--primary touch-target"
                        disabled={busyId === ca.id}
                        onClick={() => void onMarkReady(ca.id)}
                      >
                        Mark completed / Ready for review
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="issue-outcome__pending">
                  Waiting for office corrective action.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
