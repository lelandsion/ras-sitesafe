import type { SiteAssignment } from '../types/database'
import {
  isAssignedOnDate,
  submissionsForSiteDate,
  type ComplianceSubmissionSnippet,
} from './dailyCompliance'

export type WorkerTodayStatus = 'submitted' | 'missing' | 'n_a'

export type WorkerRosterRow = {
  framerId: string
  displayName: string
  /** Active site names for the date; empty means Unassigned. */
  siteNames: string[]
  todayStatus: WorkerTodayStatus
}

export const WORKER_TODAY_STATUS_LABELS: Record<WorkerTodayStatus, string> = {
  submitted: 'Submitted',
  missing: 'Missing',
  n_a: 'N/A',
}

export type WorkerRosterAssignment = Pick<
  SiteAssignment,
  'framer_id' | 'site_id' | 'assigned_at' | 'unassigned_at'
>

/**
 * People-first admin roster: one row per framer with today's active sites
 * (via isAssignedOnDate) and aggregate submission status across those sites.
 */
export function buildWorkerRosterRows(params: {
  framers: Array<{ id: string; display_name: string }>
  assignments: WorkerRosterAssignment[]
  siteNamesById: Map<string, string>
  submissions: ComplianceSubmissionSnippet[]
  dateISO: string
}): WorkerRosterRow[] {
  const { framers, assignments, siteNamesById, submissions, dateISO } = params

  const bySiteDate = new Map<string, Map<string, ComplianceSubmissionSnippet>>()
  const siteIds = new Set(assignments.map((a) => a.site_id))
  for (const siteId of siteIds) {
    bySiteDate.set(
      siteId,
      submissionsForSiteDate(siteId, dateISO, submissions),
    )
  }

  const rows: WorkerRosterRow[] = framers.map((framer) => {
    const activeSiteIds: string[] = []
    const seen = new Set<string>()
    for (const a of assignments) {
      if (a.framer_id !== framer.id) continue
      if (!isAssignedOnDate(a, dateISO)) continue
      if (seen.has(a.site_id)) continue
      seen.add(a.site_id)
      activeSiteIds.push(a.site_id)
    }

    const siteNames = activeSiteIds
      .map((id) => siteNamesById.get(id) ?? 'Unknown site')
      .sort((a, b) => a.localeCompare(b))

    let todayStatus: WorkerTodayStatus = 'n_a'
    if (activeSiteIds.length > 0) {
      const allSubmitted = activeSiteIds.every((siteId) =>
        bySiteDate.get(siteId)?.has(framer.id),
      )
      todayStatus = allSubmitted ? 'submitted' : 'missing'
    }

    return {
      framerId: framer.id,
      displayName: framer.display_name || 'Worker',
      siteNames,
      todayStatus,
    }
  })

  rows.sort((a, b) => a.displayName.localeCompare(b.displayName))
  return rows
}
