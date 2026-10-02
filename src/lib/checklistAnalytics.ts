import type { SubmissionStatus } from '../types/database'
import {
  parseDailySafetyChecklist,
  type DailySafetyChecklist,
  type HazardSeverity,
  type TriState,
} from '../types/safetyChecklist'

export type ChecklistSubmissionRow = {
  id: string
  status: SubmissionStatus
  checklist: unknown
  created_at: string
  updated_at: string
  siteName: string
  workerName: string
}

export type IssueCategory =
  | 'PPE'
  | 'Fall protection'
  | 'Tools & work area'
  | 'Hazard'
  | 'Incident / near miss'

export interface OpenIssue {
  submissionId: string
  siteName: string
  workerName: string
  category: IssueCategory
  summary: string
  severity: HazardSeverity | 'moderate' | null
  updatedAt: string
  status: SubmissionStatus
}

function triStates(checklist: DailySafetyChecklist): TriState[] {
  return [
    ...Object.values(checklist.ppe),
    ...Object.values(checklist.fallProtection),
    ...Object.values(checklist.toolsAndWorkArea),
  ].filter((v): v is TriState => v === 'yes' || v === 'no' || v === 'na')
}

export function complianceRate(checklist: DailySafetyChecklist): number | null {
  const values = triStates(checklist).filter((v) => v !== 'na')
  if (values.length === 0) return null
  const yes = values.filter((v) => v === 'yes').length
  return Math.round((yes / values.length) * 100)
}

export function countStructuredIssues(
  checklist: DailySafetyChecklist,
): number {
  let n = 0
  for (const v of triStates(checklist)) {
    if (v === 'no') n += 1
  }
  if (checklist.hazards.present) n += 1
  if (checklist.incidentOrNearMiss.occurred) n += 1
  return n
}

const PPE_LABELS: Record<keyof DailySafetyChecklist['ppe'], string> = {
  hardHat: 'Hard hat',
  highVis: 'High-vis',
  footwear: 'Footwear',
  eyeProtection: 'Eye protection',
}

const FP_LABELS: Record<keyof DailySafetyChecklist['fallProtection'], string> =
  {
    edgesProtected: 'Edges protected',
    fpInUse: 'Fall protection in use',
    ladders: 'Ladders / access',
  }

const TOOLS_LABELS: Record<
  keyof DailySafetyChecklist['toolsAndWorkArea'],
  string
> = {
  toolsCondition: 'Tools condition',
  workAreaClear: 'Work area clear',
  housekeeping: 'Housekeeping',
}

export function issuesByCategory(
  rows: ChecklistSubmissionRow[],
): { category: IssueCategory; count: number }[] {
  const counts: Record<IssueCategory, number> = {
    PPE: 0,
    'Fall protection': 0,
    'Tools & work area': 0,
    Hazard: 0,
    'Incident / near miss': 0,
  }

  for (const row of rows) {
    if (row.status === 'draft') continue
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
    for (const key of Object.keys(PPE_LABELS) as (keyof typeof PPE_LABELS)[]) {
      if (c.ppe[key] === 'no') counts.PPE += 1
    }
    for (const [key] of Object.entries(FP_LABELS) as [
      keyof typeof FP_LABELS,
      string,
    ][]) {
      if (c.fallProtection[key] === 'no') counts['Fall protection'] += 1
    }
    for (const [key] of Object.entries(TOOLS_LABELS) as [
      keyof typeof TOOLS_LABELS,
      string,
    ][]) {
      if (c.toolsAndWorkArea[key] === 'no') counts['Tools & work area'] += 1
    }
    if (c.hazards.present) counts.Hazard += 1
    if (c.incidentOrNearMiss.occurred) counts['Incident / near miss'] += 1
  }

  return (Object.keys(counts) as IssueCategory[]).map((category) => ({
    category,
    count: counts[category],
  }))
}

export function buildOpenIssues(rows: ChecklistSubmissionRow[]): OpenIssue[] {
  const issues: OpenIssue[] = []
  const openStatuses: SubmissionStatus[] = [
    'submitted',
    'under_review',
    'rejected',
  ]

  for (const row of rows) {
    if (!openStatuses.includes(row.status)) continue
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))

    for (const [key, label] of Object.entries(PPE_LABELS) as [
      keyof typeof PPE_LABELS,
      string,
    ][]) {
      if (c.ppe[key] === 'no') {
        issues.push({
          submissionId: row.id,
          siteName: row.siteName,
          workerName: row.workerName,
          category: 'PPE',
          summary: `${label}: No`,
          severity: null,
          updatedAt: row.updated_at,
          status: row.status,
        })
      }
    }
    for (const [key, label] of Object.entries(FP_LABELS) as [
      keyof typeof FP_LABELS,
      string,
    ][]) {
      if (c.fallProtection[key] === 'no') {
        issues.push({
          submissionId: row.id,
          siteName: row.siteName,
          workerName: row.workerName,
          category: 'Fall protection',
          summary: `${label}: No`,
          severity: null,
          updatedAt: row.updated_at,
          status: row.status,
        })
      }
    }
    for (const [key, label] of Object.entries(TOOLS_LABELS) as [
      keyof typeof TOOLS_LABELS,
      string,
    ][]) {
      if (c.toolsAndWorkArea[key] === 'no') {
        issues.push({
          submissionId: row.id,
          siteName: row.siteName,
          workerName: row.workerName,
          category: 'Tools & work area',
          summary: `${label}: No`,
          severity: null,
          updatedAt: row.updated_at,
          status: row.status,
        })
      }
    }
    if (c.hazards.present) {
      issues.push({
        submissionId: row.id,
        siteName: row.siteName,
        workerName: row.workerName,
        category: 'Hazard',
        summary: c.hazards.description.trim() || 'Hazard reported',
        severity: c.hazards.severity,
        updatedAt: row.updated_at,
        status: row.status,
      })
    }
    if (c.incidentOrNearMiss.occurred) {
      issues.push({
        submissionId: row.id,
        siteName: row.siteName,
        workerName: row.workerName,
        category: 'Incident / near miss',
        summary:
          c.incidentOrNearMiss.detail.trim() || 'Incident / near miss reported',
        severity: 'moderate',
        updatedAt: row.updated_at,
        status: row.status,
      })
    }
  }

  return issues.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function issuesOverTime(
  rows: ChecklistSubmissionRow[],
): { date: string; issues: number }[] {
  const byDay = new Map<string, number>()
  for (const row of rows) {
    if (row.status === 'draft') continue
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
    const n = countStructuredIssues(c)
    if (n === 0) continue
    const day = c.checkDate || row.created_at.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + n)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, issues]) => ({ date, issues }))
}

export function complianceOverTime(
  rows: ChecklistSubmissionRow[],
): { date: string; compliance: number }[] {
  const byDay = new Map<string, { sum: number; n: number }>()
  for (const row of rows) {
    if (row.status === 'draft') continue
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
    const rate = complianceRate(c)
    if (rate === null) continue
    const day = c.checkDate || row.created_at.slice(0, 10)
    const prev = byDay.get(day) ?? { sum: 0, n: 0 }
    byDay.set(day, { sum: prev.sum + rate, n: prev.n + 1 })
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, n }]) => ({
      date,
      compliance: Math.round(sum / n),
    }))
}

export function aggregateSafetyMetrics(rows: ChecklistSubmissionRow[]) {
  const nonDraft = rows.filter((r) => r.status !== 'draft')
  let hazardReports = 0
  let incidents = 0
  let complianceSum = 0
  let complianceN = 0
  let issueTotal = 0

  for (const row of nonDraft) {
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
    if (c.hazards.present) hazardReports += 1
    if (c.incidentOrNearMiss.occurred) incidents += 1
    issueTotal += countStructuredIssues(c)
    const rate = complianceRate(c)
    if (rate !== null) {
      complianceSum += rate
      complianceN += 1
    }
  }

  return {
    submissions: nonDraft.length,
    hazardReports,
    incidents,
    openIssueCount: buildOpenIssues(rows).length,
    avgCompliance:
      complianceN > 0 ? Math.round(complianceSum / complianceN) : null,
    issueTotal,
  }
}
