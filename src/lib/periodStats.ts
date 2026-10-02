import {
  buildOpenIssues,
  complianceOverTime,
  countStructuredIssues,
  issuesOverTime,
  type ChecklistSubmissionRow,
} from './checklistAnalytics'
import {
  parseDailySafetyChecklist,
  type DailySafetyChecklist,
} from '../types/safetyChecklist'
import type { SavedReportSummary, TopIssueCount } from '../types/savedReport'

/** Inclusive weekday count (Mon–Fri) between YYYY-MM-DD bounds. */
export function countWeekdaysInclusive(fromDate: string, toDate: string): number {
  const start = parseYmd(fromDate)
  const end = parseYmd(toDate)
  if (!start || !end || end < start) return 0
  let n = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) n += 1
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

export function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null
  }
  return dt
}

export function checkDateInRange(
  checklist: DailySafetyChecklist,
  fromDate: string,
  toDate: string,
): boolean {
  const day = checklist.checkDate
  return day >= fromDate && day <= toDate
}

export function monthBounds(year: number, month: number): {
  fromDate: string
  toDate: string
} {
  const fromDate = `${year}-${String(month).padStart(2, '0')}-01`
  const last = new Date(year, month, 0).getDate()
  const toDate = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { fromDate, toDate }
}

export function defaultPeriodRange(now = new Date()): {
  fromDate: string
  toDate: string
  year: number
  month: number
} {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return { ...monthBounds(year, month), year, month }
}

/** Named buckets matching the admin REPORTS mock: Fall Protection, PPE, Housekeeping, Tools. */
export function topNamedIssueCounts(
  rows: ChecklistSubmissionRow[],
): TopIssueCount[] {
  const counts: Record<TopIssueCount['name'], number> = {
    'Fall Protection': 0,
    PPE: 0,
    Housekeeping: 0,
    Tools: 0,
  }

  for (const row of rows) {
    if (row.status === 'draft') continue
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
    for (const v of Object.values(c.fallProtection)) {
      if (v === 'no') counts['Fall Protection'] += 1
    }
    for (const v of Object.values(c.ppe)) {
      if (v === 'no') counts.PPE += 1
    }
    if (c.toolsAndWorkArea.housekeeping === 'no') counts.Housekeeping += 1
    if (c.toolsAndWorkArea.toolsCondition === 'no') counts.Tools += 1
    if (c.toolsAndWorkArea.workAreaClear === 'no') counts.Tools += 1
  }

  return (Object.keys(counts) as TopIssueCount['name'][]).map((name) => ({
    name,
    count: counts[name],
  }))
}

export function countHighPriorityHazards(rows: ChecklistSubmissionRow[]): number {
  let n = 0
  for (const row of rows) {
    if (row.status === 'draft') continue
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
    if (c.hazards.present && c.hazards.severity === 'high') n += 1
  }
  return n
}

export function countResolvedIssues(rows: ChecklistSubmissionRow[]): number {
  let n = 0
  for (const row of rows) {
    if (row.status !== 'approved') continue
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
    n += countStructuredIssues(c)
  }
  return n
}

export function countSafetyIssues(rows: ChecklistSubmissionRow[]): number {
  let n = 0
  for (const row of rows) {
    if (row.status === 'draft') continue
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
    n += countStructuredIssues(c)
  }
  return n
}

/**
 * Expected = assigned framers × weekdays in range.
 * Falls back to unique submitters when assignment count is 0.
 * Marks estimate when we had to invent a worker baseline.
 */
export function estimateExpectedSubmissions(params: {
  fromDate: string
  toDate: string
  assignedFramerCount: number
  uniqueSubmitters: number
}): { expected: number; estimated: boolean } {
  const weekdays = countWeekdaysInclusive(params.fromDate, params.toDate)
  if (weekdays === 0) return { expected: 0, estimated: false }

  if (params.assignedFramerCount > 0) {
    return {
      expected: weekdays * params.assignedFramerCount,
      estimated: false,
    }
  }

  const workers = Math.max(params.uniqueSubmitters, 1)
  return {
    expected: weekdays * workers,
    estimated: true,
  }
}

export function buildAggregateSummary(params: {
  rows: ChecklistSubmissionRow[]
  fromDate: string
  toDate: string
  assignedFramerCount: number
  photoCount: number
}): SavedReportSummary {
  const { rows, fromDate, toDate, assignedFramerCount, photoCount } = params
  const uniqueSubmitters = new Set(rows.map((r) => r.workerName)).size
  const { expected, estimated } = estimateExpectedSubmissions({
    fromDate,
    toDate,
    assignedFramerCount,
    uniqueSubmitters,
  })

  const submitted = rows.length
  const missing = Math.max(expected - submitted, 0)
  const completionPct =
    expected > 0 ? Math.round((Math.min(submitted, expected) / expected) * 100) : null

  let complianceSum = 0
  let complianceN = 0
  let hazardCount = 0
  let incidentCount = 0
  for (const row of rows) {
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
    if (c.hazards.present) hazardCount += 1
    if (c.incidentOrNearMiss.occurred) incidentCount += 1
    const values = [
      ...Object.values(c.ppe),
      ...Object.values(c.fallProtection),
      ...Object.values(c.toolsAndWorkArea),
    ].filter((v) => v === 'yes' || v === 'no')
    if (values.length > 0) {
      const yes = values.filter((v) => v === 'yes').length
      complianceSum += Math.round((yes / values.length) * 100)
      complianceN += 1
    }
  }

  const openIssues = buildOpenIssues(rows)
  const issueLines = openIssues.slice(0, 12).map(
    (i) => `${i.workerName} · ${i.category}: ${i.summary}`,
  )

  const correctiveLines = rows
    .map((row) => {
      const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
      const n = countStructuredIssues(c)
      if (n === 0) return null
      return `${row.workerName} (${c.checkDate}): ${n} item(s) flagged — follow up on site.`
    })
    .filter((line): line is string => Boolean(line))
    .slice(0, 8)

  return {
    submissionCount: submitted,
    avgCompliance: complianceN > 0 ? Math.round(complianceSum / complianceN) : null,
    hazardCount,
    incidentCount,
    openIssueCount: openIssues.length,
    issueLines,
    correctiveLines,
    photoCount,
    generatedAt: new Date().toISOString(),
    expectedSubmissions: expected,
    missingSubmissions: missing,
    completionPct,
    expectedIsEstimate: estimated,
    safetyIssueCount: countSafetyIssues(rows),
    highPriorityCount: countHighPriorityHazards(rows),
    nearMissCount: incidentCount,
    resolvedIssueCount: countResolvedIssues(rows),
    topIssues: topNamedIssueCounts(rows),
    complianceSeries: complianceOverTime(rows),
    issuesSeries: issuesOverTime(rows),
    notableIssues: issueLines,
  }
}

export function emptyAggregateSummary(): SavedReportSummary {
  return {
    submissionCount: 0,
    avgCompliance: null,
    hazardCount: 0,
    incidentCount: 0,
    openIssueCount: 0,
    issueLines: [],
    correctiveLines: [],
    photoCount: 0,
    generatedAt: new Date().toISOString(),
    expectedSubmissions: 0,
    missingSubmissions: 0,
    completionPct: null,
    expectedIsEstimate: true,
    safetyIssueCount: 0,
    highPriorityCount: 0,
    nearMissCount: 0,
    resolvedIssueCount: 0,
    topIssues: [
      { name: 'Fall Protection', count: 0 },
      { name: 'PPE', count: 0 },
      { name: 'Housekeeping', count: 0 },
      { name: 'Tools', count: 0 },
    ],
    complianceSeries: [],
    issuesSeries: [],
    notableIssues: [],
  }
}

/** Demo fill when period has no live submissions (keeps admin UX reviewable). */
export function demoAggregateFallback(siteName: string): SavedReportSummary {
  const base = emptyAggregateSummary()
  return {
    ...base,
    submissionCount: 18,
    avgCompliance: 91,
    hazardCount: 2,
    incidentCount: 1,
    openIssueCount: 4,
    issueLines: [
      `${siteName} · Fall protection: Edges protected: No`,
      `${siteName} · PPE: Hard hat: No`,
      `${siteName} · Hazard: Unsecured material near walkway`,
      `${siteName} · Tools & work area: Housekeeping: No`,
    ],
    correctiveLines: [
      'Review edge protection at west elevation.',
      'Reinforce PPE check at morning huddle.',
    ],
    photoCount: 7,
    expectedSubmissions: 22,
    missingSubmissions: 4,
    completionPct: 82,
    expectedIsEstimate: true,
    safetyIssueCount: 9,
    highPriorityCount: 1,
    nearMissCount: 1,
    resolvedIssueCount: 5,
    topIssues: [
      { name: 'Fall Protection', count: 3 },
      { name: 'PPE', count: 2 },
      { name: 'Housekeeping', count: 2 },
      { name: 'Tools', count: 1 },
    ],
    complianceSeries: [
      { date: '2026-10-06', compliance: 88 },
      { date: '2026-10-13', compliance: 92 },
      { date: '2026-10-20', compliance: 90 },
      { date: '2026-10-27', compliance: 94 },
    ],
    issuesSeries: [
      { date: '2026-10-06', issues: 3 },
      { date: '2026-10-13', issues: 2 },
      { date: '2026-10-20', issues: 4 },
      { date: '2026-10-27', issues: 1 },
    ],
    notableIssues: [
      'Fall protection: Edges protected: No — west elevation',
      'PPE: Hard hat: No — two checks',
      'Hazard (high): Unsecured material near walkway',
      'Housekeeping: No — staging area',
    ],
    generatedAt: new Date().toISOString(),
  }
}
