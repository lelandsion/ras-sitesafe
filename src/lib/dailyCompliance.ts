import type { SiteAssignment } from '../types/database'
import { parseDailySafetyChecklist } from '../types/safetyChecklist'
import { countStructuredIssues } from './checklistAnalytics'
import {
  issueKindFromChecklistKey,
  requiredIssueSpecs,
  SAFETY_ISSUE_KIND_LABELS,
  type SafetyIssueKind,
} from './safetyIssueKeys'

export type ComplianceWorkerStatus =
  | 'submitted'
  | 'safety_issue'
  | 'not_submitted'

export type ComplianceFilter = 'all' | 'submitted' | 'missing' | 'issues'

export type ComplianceSubmissionSnippet = {
  id: string
  site_id: string
  submitted_by: string
  status: string
  checklist: unknown
  created_at: string
  updated_at: string
}

export type ComplianceWorkerRow = {
  framerId: string
  displayName: string
  status: ComplianceWorkerStatus
  /** Submission time when submitted; null when missing. */
  submittedAt: string | null
  submissionId: string | null
  issueCount: number
  /** Distinct kinds present (hazard vs incident vs checklist failure). */
  issueKinds: SafetyIssueKind[]
}

export type ComplianceSummary = {
  assigned: number
  submitted: number
  missing: number
  issues: number
}

/** Local calendar date YYYY-MM-DD. */
export function localDateISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function shiftDateISO(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return localDateISO(dt)
}

/** Local YYYY-MM-DD for timestamptz; plain dates kept as-is (no UTC shift). */
function toLocalCalendarDay(iso: string): string {
  const trimmed = iso.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  return localDateISO(new Date(trimmed))
}

/**
 * Assignment active on calendar date D (local):
 * assigned_at local day <= D AND (unassigned_at is null OR unassigned local day > D).
 * Exclusive end: soft-unassign on D drops them from Missing on D and after.
 * Use local calendar days (not UTC YYYY-MM-DD slice) so evening unassigns in
 * western timezones do not stay "assigned" until UTC midnight.
 */
export function isAssignedOnDate(
  assignment: Pick<SiteAssignment, 'assigned_at' | 'unassigned_at'>,
  dateISO: string,
): boolean {
  const assignedDay = toLocalCalendarDay(assignment.assigned_at)
  if (assignedDay > dateISO) return false
  if (!assignment.unassigned_at) return true
  const unDay = toLocalCalendarDay(assignment.unassigned_at)
  return unDay > dateISO
}

function submissionCheckDate(sub: ComplianceSubmissionSnippet): string {
  const c = parseDailySafetyChecklist(sub.checklist, sub.created_at.slice(0, 10))
  return c.checkDate || sub.created_at.slice(0, 10)
}

/** Non-draft submissions for the site/date (prefer latest per worker). */
export function submissionsForSiteDate(
  siteId: string,
  dateISO: string,
  submissions: ComplianceSubmissionSnippet[],
): Map<string, ComplianceSubmissionSnippet> {
  const map = new Map<string, ComplianceSubmissionSnippet>()
  for (const sub of submissions) {
    if (sub.site_id !== siteId) continue
    if (sub.status === 'draft') continue
    if (submissionCheckDate(sub) !== dateISO) continue
    const prev = map.get(sub.submitted_by)
    if (!prev || sub.updated_at > prev.updated_at) {
      map.set(sub.submitted_by, sub)
    }
  }
  return map
}

export function buildComplianceRows(params: {
  assignments: Array<
    Pick<SiteAssignment, 'framer_id' | 'assigned_at' | 'unassigned_at'> & {
      framer: { id: string; display_name: string } | null
    }
  >
  siteId: string
  dateISO: string
  submissions: ComplianceSubmissionSnippet[]
}): ComplianceWorkerRow[] {
  const { assignments, siteId, dateISO, submissions } = params
  const byWorker = submissionsForSiteDate(siteId, dateISO, submissions)

  const rows: ComplianceWorkerRow[] = []
  const seen = new Set<string>()

  for (const a of assignments) {
    if (!isAssignedOnDate(a, dateISO)) continue
    if (seen.has(a.framer_id)) continue
    seen.add(a.framer_id)

    const sub = byWorker.get(a.framer_id)
    const name = a.framer?.display_name ?? 'Worker'
    if (!sub) {
      rows.push({
        framerId: a.framer_id,
        displayName: name,
        status: 'not_submitted',
        submittedAt: null,
        submissionId: null,
        issueCount: 0,
        issueKinds: [],
      })
      continue
    }

    const checklist = parseDailySafetyChecklist(
      sub.checklist,
      sub.created_at.slice(0, 10),
    )
    const issueCount = countStructuredIssues(checklist)
    const kindSet = new Set<SafetyIssueKind>()
    for (const spec of requiredIssueSpecs(checklist)) {
      kindSet.add(issueKindFromChecklistKey(spec.key))
    }
    rows.push({
      framerId: a.framer_id,
      displayName: name,
      status: issueCount > 0 ? 'safety_issue' : 'submitted',
      submittedAt: sub.updated_at,
      submissionId: sub.id,
      issueCount,
      issueKinds: [...kindSet],
    })
  }

  rows.sort((a, b) => a.displayName.localeCompare(b.displayName))
  return rows
}

export function summarizeCompliance(
  rows: ComplianceWorkerRow[],
): ComplianceSummary {
  let submitted = 0
  let missing = 0
  let issues = 0
  for (const r of rows) {
    if (r.status === 'not_submitted') missing += 1
    else {
      submitted += 1
      if (r.status === 'safety_issue') issues += 1
    }
  }
  return {
    assigned: rows.length,
    submitted,
    missing,
    issues,
  }
}

export function filterComplianceRows(
  rows: ComplianceWorkerRow[],
  filter: ComplianceFilter,
): ComplianceWorkerRow[] {
  if (filter === 'all') return rows
  if (filter === 'submitted') {
    return rows.filter(
      (r) => r.status === 'submitted' || r.status === 'safety_issue',
    )
  }
  if (filter === 'missing') {
    return rows.filter((r) => r.status === 'not_submitted')
  }
  return rows.filter((r) => r.status === 'safety_issue')
}

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceWorkerStatus, string> =
  {
    submitted: 'Submitted',
    safety_issue: 'Safety Issue',
    not_submitted: 'Not Submitted',
  }

/** Short label list for compliance detail (e.g. "Hazard + Incident"). */
export function formatIssueKindSummary(kinds: SafetyIssueKind[]): string {
  if (kinds.length === 0) return ''
  return kinds.map((k) => SAFETY_ISSUE_KIND_LABELS[k]).join(' · ')
}
