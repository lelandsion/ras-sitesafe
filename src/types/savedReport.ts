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
