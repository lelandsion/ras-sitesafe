import type { SubmissionStatus } from '../../types/database'
import { SUBMISSION_STATUS_LABELS } from '../../types/database'

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  draft: 'status-badge--draft',
  submitted: 'status-badge--submitted',
  under_review: 'status-badge--review',
  approved: 'status-badge--approved',
  rejected: 'status-badge--rejected',
}

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span className={`status-badge ${STATUS_CLASS[status]}`}>
      {SUBMISSION_STATUS_LABELS[status]}
    </span>
  )
}
