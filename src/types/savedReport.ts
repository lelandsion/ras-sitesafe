export type ReportIncludeOptions = {
  safetySummary: boolean
  submissionCompliance: boolean
  safetyIssues: boolean
  correctiveActions: boolean
  photos: boolean
}

export const DEFAULT_REPORT_INCLUDES: ReportIncludeOptions = {
  safetySummary: true,
  submissionCompliance: true,
  safetyIssues: true,
  correctiveActions: true,
  photos: true,
}

export type TopIssueCount = {
  name: 'Fall Protection' | 'PPE' | 'Housekeeping' | 'Tools'
  count: number
}

export type SavedReportSummary = {
  submissionCount: number
  avgCompliance: number | null
  hazardCount: number
  incidentCount: number
  openIssueCount: number
  issueLines: string[]
  correctiveLines: string[]
  photoCount: number
  generatedAt: string
  /** Assigned framers × weekdays (or estimated when assignments missing). */
  expectedSubmissions: number
  missingSubmissions: number
  completionPct: number | null
  expectedIsEstimate: boolean
  safetyIssueCount: number
  highPriorityCount: number
  nearMissCount: number
  resolvedIssueCount: number
  topIssues: TopIssueCount[]
  complianceSeries: { date: string; compliance: number }[]
  issuesSeries: { date: string; issues: number }[]
  notableIssues: string[]
}

export interface SavedReport {
  id: string
  created_by: string
  site_id: string | null
  site_name: string
  period_year: number
  period_month: number
  title: string
  options: ReportIncludeOptions
  summary: SavedReportSummary
  created_at: string
}

export function periodLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

export function formatReportListDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export function formatReportRangeLabel(fromDate: string, toDate: string): string {
  try {
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const [y1, m1, d1] = fromDate.split('-').map(Number)
    const [y2, m2, d2] = toDate.split('-').map(Number)
    return `${fmt.format(new Date(y1, m1 - 1, d1))} — ${fmt.format(new Date(y2, m2 - 1, d2))}`
  } catch {
    return `${fromDate} — ${toDate}`
  }
}

export function safetyReportHeading(siteName: string, year: number, month: number): string {
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' })
    .format(new Date(year, month - 1, 1))
    .toUpperCase()
  return `${siteName.toUpperCase()} — ${monthName} SAFETY REPORT`
}
