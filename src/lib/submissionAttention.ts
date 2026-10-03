import type { SubmissionStatus, SubmissionWithDetails } from '../types/database'

/**
 * When an admin opens a corrective action against a linked submission,
 * move the submission into review — but never downgrade approved/rejected,
 * and leave an already-under_review row unchanged.
 */
export function nextStatusOnCorrectiveActionCreate(
  current: SubmissionStatus,
): 'under_review' | null {
  if (
    current === 'approved' ||
    current === 'rejected' ||
    current === 'under_review'
  ) {
    return null
  }
  return 'under_review'
}

/** Patch to apply when create-CA should stamp review fields. */
export function reviewPatchOnCorrectiveActionCreate(
  current: SubmissionStatus,
  reviewerId: string,
  reviewedAtIso: string = new Date().toISOString(),
): {
  status: 'under_review'
  reviewed_by: string
  reviewed_at: string
} | null {
  if (!nextStatusOnCorrectiveActionCreate(current)) return null
  return {
    status: 'under_review',
    reviewed_by: reviewerId,
    reviewed_at: reviewedAtIso,
  }
}

/** Attention order for the admin Worker Submissions list (drafts excluded). */
const ADMIN_STATUS_RANK: Record<SubmissionStatus, number> = {
  under_review: 0,
  submitted: 1,
  approved: 2,
  rejected: 3,
  draft: 99,
}

/**
 * Framer My submissions: keep work-in-progress higher; terminal Reviewed
 * (`approved`) and rejected at the bottom. Newest-first within each bucket.
 */
const FRAMER_STATUS_RANK: Record<SubmissionStatus, number> = {
  under_review: 0,
  submitted: 1,
  draft: 2,
  approved: 3,
  rejected: 4,
}

function attentionDateMs(item: Pick<SubmissionWithDetails, 'updated_at' | 'created_at'>): number {
  const raw = item.updated_at || item.created_at
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * Sort for admin attention: under_review → submitted → approved → rejected,
 * newest-first within each status bucket. Drafts are not shown in admin lists.
 */
export function sortAdminSubmissions<
  T extends Pick<SubmissionWithDetails, 'status' | 'updated_at' | 'created_at'>,
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rankA = ADMIN_STATUS_RANK[a.status] ?? 99
    const rankB = ADMIN_STATUS_RANK[b.status] ?? 99
    if (rankA !== rankB) return rankA - rankB
    return attentionDateMs(b) - attentionDateMs(a)
  })
}

/**
 * Sort for framer home: under_review → submitted → draft → approved → rejected,
 * newest-first within each status bucket.
 */
export function sortFramerSubmissions<
  T extends Pick<SubmissionWithDetails, 'status' | 'updated_at' | 'created_at'>,
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rankA = FRAMER_STATUS_RANK[a.status] ?? 99
    const rankB = FRAMER_STATUS_RANK[b.status] ?? 99
    if (rankA !== rankB) return rankA - rankB
    return attentionDateMs(b) - attentionDateMs(a)
  })
}
