import {
  issuePhotoCaptureAllowed,
  ISSUE_SEVERITY_LABELS,
  type IssueDraft,
} from '../../lib/safetyIssueKeys'
import type { IssueSeverity } from '../../types/correctiveActions'

type Props = {
  draft: IssueDraft
  disabled?: boolean
  onChange: (next: IssueDraft) => void
  /** Field-keyed messages from submit validation (e.g. issue.ppe.hardHat.description). */
  errors?: Partial<
    Record<'description' | 'severity' | 'immediate_action', string>
  >
}

const SEVERITIES: IssueSeverity[] = ['low', 'medium', 'high']

export function IssueCapturePanel({
  draft,
  disabled,
  onChange,
  errors,
}: Props) {
  const showIssuePhoto = issuePhotoCaptureAllowed(draft.checklist_item_key)

  return (
    <div
      className="issue-capture"
      data-testid={`issue-capture-${draft.checklist_item_key}`}
      data-show-issue-photo={showIssuePhoto ? 'true' : 'false'}
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
            className={`safety-form__control safety-form__textarea${errors?.description ? ' is-invalid' : ''}`}
            rows={2}
            disabled={disabled}
            aria-invalid={errors?.description ? true : undefined}
            value={draft.description}
            onChange={(e) =>
              onChange({ ...draft, description: e.target.value })
            }
            placeholder="What did you see?"
          />
          {errors?.description && (
            <span className="field-error" role="alert">
              {errors.description}
            </span>
          )}
        </label>

        <label className="safety-form__field">
          <span>Severity *</span>
          <select
            className={`safety-form__control touch-target${errors?.severity ? ' is-invalid' : ''}`}
            disabled={disabled}
            aria-invalid={errors?.severity ? true : undefined}
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
          {errors?.severity && (
            <span className="field-error" role="alert">
              {errors.severity}
            </span>
          )}
        </label>

        <label className="safety-form__field">
          <span>Immediate action *</span>
          <textarea
            className={`safety-form__control safety-form__textarea${errors?.immediate_action ? ' is-invalid' : ''}`}
            rows={2}
            disabled={disabled}
            aria-invalid={errors?.immediate_action ? true : undefined}
            value={draft.immediate_action}
            onChange={(e) =>
              onChange({ ...draft, immediate_action: e.target.value })
            }
            placeholder="What did the crew do right away?"
          />
          {errors?.immediate_action && (
            <span className="field-error" role="alert">
              {errors.immediate_action}
            </span>
          )}
        </label>

        {showIssuePhoto && (
          <label
            className="safety-form__field"
            data-testid={`issue-photo-${draft.checklist_item_key}`}
          >
            <span>Issue photo (optional)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="safety-form__control issue-capture__file-input"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                onChange({ ...draft, pendingPhoto: file })
              }}
            />
            {draft.pendingPhoto && (
              <span className="issue-capture__file">
                {draft.pendingPhoto.name}
              </span>
            )}
          </label>
        )}
      </div>
    </div>
  )
}
