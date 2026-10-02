import type { SafetyIssueWithDetails } from '../../types/correctiveActions'
import {
  CA_PRIORITY_LABELS,
  CA_STATUS_LABELS,
  ISSUE_SEVERITY_LABELS,
} from '../../types/correctiveActions'

type Props = {
  issues: SafetyIssueWithDetails[]
  loading?: boolean
}

export function SubmissionIssuesPanel({ issues, loading }: Props) {
  if (loading) {
    return (
      <section className="check-section" aria-labelledby="safety-issues-ro">
        <h3 id="safety-issues-ro" className="check-section__title">
          Safety issues
        </h3>
        <p className="check-section__lead">Loading issues…</p>
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
      <ul className="issue-outcome-list">
        {issues.map((issue) => {
          const ca = issue.corrective_action
          return (
            <li key={issue.id} className="issue-outcome">
              <div className="issue-outcome__head">
                <h4 className="issue-outcome__title">{issue.item_label}</h4>
                <span
                  className={`severity-badge severity-badge--${issue.severity}`}
                >
                  {ISSUE_SEVERITY_LABELS[issue.severity]}
                </span>
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
