import { countStructuredIssues } from './checklistAnalytics'
import type { SubmissionStatus, SubmissionWithDetails } from '../types/database'
import { parseDailySafetyChecklist } from '../types/safetyChecklist'

export type IssuesFilter = 'all' | 'has_issues' | 'no_issues'

export type SubmissionListFilters = {
  siteId: string
  workerId: string
  dateFrom: string
  dateTo: string
  issues: IssuesFilter
  status: SubmissionStatus | 'all'
}

export const EMPTY_SUBMISSION_FILTERS: SubmissionListFilters = {
  siteId: '',
  workerId: '',
  dateFrom: '',
  dateTo: '',
  issues: 'all',
  status: 'all',
}

export function checkDateForSubmission(item: SubmissionWithDetails): string {
  const checklist = parseDailySafetyChecklist(
    item.checklist,
    item.created_at.slice(0, 10),
  )
  return checklist.checkDate || item.created_at.slice(0, 10)
}

/** Drafts are framer-private — strip them from admin queues. */
export function excludeDraftSubmissions<
  T extends { status: SubmissionStatus },
>(items: T[]): T[] {
  return items.filter((item) => item.status !== 'draft')
}

export function filterSubmissions(
  items: SubmissionWithDetails[],
  filters: SubmissionListFilters,
): SubmissionWithDetails[] {
  return items.filter((item) => {
    // Admin UI never surfaces other people's drafts.
    if (item.status === 'draft') return false
    if (filters.siteId && item.site_id !== filters.siteId) return false
    if (filters.workerId && item.submitted_by !== filters.workerId) return false
    if (filters.status !== 'all' && item.status !== filters.status) return false

    const checkDate = checkDateForSubmission(item)
    if (filters.dateFrom && checkDate < filters.dateFrom) return false
    if (filters.dateTo && checkDate > filters.dateTo) return false

    if (filters.issues !== 'all') {
      const checklist = parseDailySafetyChecklist(
        item.checklist,
        item.created_at.slice(0, 10),
      )
      const hasIssues = countStructuredIssues(checklist) > 0
      if (filters.issues === 'has_issues' && !hasIssues) return false
      if (filters.issues === 'no_issues' && hasIssues) return false
    }

    return true
  })
}

export function uniqueSitesFromSubmissions(
  items: SubmissionWithDetails[],
): { id: string; name: string }[] {
  const map = new Map<string, string>()
  for (const item of items) {
    if (!map.has(item.site_id)) {
      map.set(item.site_id, item.sites?.name ?? 'Unknown site')
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function uniqueWorkersFromSubmissions(
  items: SubmissionWithDetails[],
): { id: string; name: string }[] {
  const map = new Map<string, string>()
  for (const item of items) {
    if (!map.has(item.submitted_by)) {
      map.set(
        item.submitted_by,
        item.submitter?.display_name ?? 'Unknown worker',
      )
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function countActiveFilters(filters: SubmissionListFilters): number {
  let n = 0
  if (filters.siteId) n += 1
  if (filters.workerId) n += 1
  if (filters.dateFrom) n += 1
  if (filters.dateTo) n += 1
  if (filters.issues !== 'all') n += 1
  if (filters.status !== 'all') n += 1
  return n
}
