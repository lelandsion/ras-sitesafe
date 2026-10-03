import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import type {
  CorrectiveActionPriority,
  SafetyIssueWithDetails,
} from '../../types/correctiveActions'
import {
  CA_PRIORITY_LABELS,
  ISSUE_SEVERITY_LABELS,
} from '../../types/correctiveActions'
import { issueKindFromChecklistKey } from '../../lib/safetyIssueKeys'
import { IssueKindBadge } from '../ui/IssueKindBadge'

type Props = {
  open: boolean
  issue: SafetyIssueWithDetails | null
  saving: boolean
  error: string | null
  onClose: () => void
  onCreate: (input: {
    required_action: string
    priority: CorrectiveActionPriority
    due_date: string | null
  }) => void
}

export function CorrectiveActionModal({
  open,
  issue,
  saving,
  error,
  onClose,
  onCreate,
}: Props) {
  const titleId = useId()
  const [requiredAction, setRequiredAction] = useState('')
  const [priority, setPriority] = useState<CorrectiveActionPriority>('medium')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (!open || !issue) return
    setRequiredAction('')
    setPriority(
      issue.severity === 'high'
        ? 'high'
        : issue.severity === 'low'
          ? 'low'
          : 'medium',
    )
    setDueDate('')
  }, [open, issue])

  if (!open || !issue) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id={titleId} className="modal__title">
            Create corrective action
          </h2>
          <button
            type="button"
            className="btn btn--ghost touch-target"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <div className="ca-modal__issue">
          <p>
            <strong>{issue.item_label}</strong>
            <IssueKindBadge
              kind={issueKindFromChecklistKey(issue.checklist_item_key)}
            />
            <span
              className={`severity-badge severity-badge--${issue.severity}`}
            >
              {ISSUE_SEVERITY_LABELS[issue.severity]}
            </span>
          </p>
          <p>{issue.description}</p>
          <p className="ca-modal__meta">
            {issue.submission?.sites?.name ?? 'Site'} ·{' '}
            {issue.submission?.submitter?.display_name ?? 'Worker'}
          </p>
        </div>

        {error && (
          <p className="form-banner form-banner--error" role="alert">
            {error}
          </p>
        )}

        <form
          className="safety-form"
          onSubmit={(e) => {
            e.preventDefault()
            onCreate({
              required_action: requiredAction,
              priority,
              due_date: dueDate || null,
            })
          }}
        >
          <label className="safety-form__field">
            <span>Required action *</span>
            <textarea
              className="safety-form__control safety-form__textarea"
              rows={3}
              required
              disabled={saving}
              value={requiredAction}
              onChange={(e) => setRequiredAction(e.target.value)}
              placeholder="What must be done to close this issue?"
            />
          </label>
          <label className="safety-form__field">
            <span>Priority</span>
            <select
              className="safety-form__control touch-target"
              disabled={saving}
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as CorrectiveActionPriority)
              }
            >
              {(Object.keys(CA_PRIORITY_LABELS) as CorrectiveActionPriority[]).map(
                (p) => (
                  <option key={p} value={p}>
                    {CA_PRIORITY_LABELS[p]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="safety-form__field">
            <span>Due date (optional)</span>
            <input
              type="date"
              className="safety-form__control touch-target"
              disabled={saving}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn--ghost touch-target"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary touch-target"
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create (Open)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
