import type {
  CorrectiveActionStatus,
  SafetyIssueWithDetails,
} from '../types/correctiveActions'

/** Active CA statuses that should surface on submission list cards. */
export type SubmissionCaAttention = Extract<
  CorrectiveActionStatus,
  'open' | 'in_progress' | 'ready_for_review'
>

const CA_ISSUE_RANK: Record<string, number> = {
  open: 0,
  in_progress: 1,
  ready_for_review: 2,
  resolved: 3,
  none: 4,
}

/**
 * Pick the highest-attention active CA status for a submission card badge.
 * ready_for_review wins over in_progress / open; resolved/absent → null.
 */
export function pickActiveCaAttention(
  statuses: Array<CorrectiveActionStatus | null | undefined>,
): SubmissionCaAttention | null {
  let hasOpen = false
  let hasInProgress = false
  for (const status of statuses) {
    if (status === 'ready_for_review') return 'ready_for_review'
    if (status === 'in_progress') hasInProgress = true
    else if (status === 'open') hasOpen = true
  }
  if (hasInProgress) return 'in_progress'
  if (hasOpen) return 'open'
  return null
}

/** Card badge copy — do not require opening the form to see CA state. */
export function caAttentionBadgeLabel(
  attention: SubmissionCaAttention | null | undefined,
): string | null {
  if (attention === 'ready_for_review') return 'CA ready for review'
  if (attention === 'open' || attention === 'in_progress') {
    return 'Corrective action'
  }
  return null
}

function issueCaRank(issue: SafetyIssueWithDetails): number {
  const status = issue.corrective_action?.status
  if (!status) return CA_ISSUE_RANK.none
  return CA_ISSUE_RANK[status] ?? CA_ISSUE_RANK.none
}

function issueDateMs(issue: Pick<SafetyIssueWithDetails, 'created_at'>): number {
  const ms = Date.parse(issue.created_at)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * Admin Safety Issues list: open → in_progress → ready_for_review → resolved,
 * then no-CA / other last. Newest-first within each bucket.
 */
export function sortSafetyIssuesByCaStatus<T extends SafetyIssueWithDetails>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const rankA = issueCaRank(a)
    const rankB = issueCaRank(b)
    if (rankA !== rankB) return rankA - rankB
    return issueDateMs(b) - issueDateMs(a)
  })
}
