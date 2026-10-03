import {
  SAFETY_ISSUE_KIND_LABELS,
  type SafetyIssueKind,
} from '../../lib/safetyIssueKeys'

export function IssueKindBadge({ kind }: { kind: SafetyIssueKind }) {
  return (
    <span
      className={`issue-kind-badge issue-kind-badge--${kind}`}
      data-testid={`issue-kind-${kind}`}
    >
      {SAFETY_ISSUE_KIND_LABELS[kind]}
    </span>
  )
}
