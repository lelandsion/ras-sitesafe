import type { IssueDraft } from '../../lib/safetyIssueKeys'
import { ISSUE_SEVERITY_LABELS } from '../../lib/safetyIssueKeys'
import type { IssueSeverity } from '../../types/correctiveActions'

type Props = {
  draft: IssueDraft
  disabled?: boolean
  onChange: (next: IssueDraft) => void
}

const SEVERITIES: IssueSeverity[] = ['low', 'medium', 'high']

export function IssueCapturePanel({ draft, disabled, onChange }: Props) {
  return (
    <div
      className="issue-capture"
      data-testid={`issue-capture-${draft.checklist_item_key}`}
    >
      <p className="issue-capture__title">
        Safety issue — <strong>{draft.item_label}</strong>
      </p>
      <p className="issue-capture__lead">
        Answered No / reported — capture what happened and the immediate action.
      </p>

      <div className="issue-capture__fields">
        <label className="safety-form__field">
          <span>Description *</span>
          <textarea
            className="safety-form__control safety-form__textarea"
            rows={2}
            required
            disabled={disabled}
            value={draft.description}
            onChange={(e) =>
              onChange({ ...draft, description: e.target.value })
            }
            placeholder="What did you see?"
          />
        </label>

        <label className="safety-form__field">
          <span>Severity *</span>
          <select
            className="safety-form__control touch-target"
            required
            disabled={disabled}
            value={draft.severity ?? ''}
            onChange={(e) =>
              onChange({
                ...draft,
                severity: (e.target.value || null) as IssueSeverity | null,
              })
            }
          >
            <option value="">Select…</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {ISSUE_SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="safety-form__field">
          <span>Immediate action *</span>
          <textarea
            className="safety-form__control safety-form__textarea"
            rows={2}
            required
            disabled={disabled}
            value={draft.immediate_action}
            onChange={(e) =>
              onChange({ ...draft, immediate_action: e.target.value })
            }
            placeholder="What did the crew do right away?"
          />
        </label>
      </div>
    </div>
  )
}
