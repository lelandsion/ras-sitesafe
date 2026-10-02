import {
  aggregateSafetyMetrics,
  buildOpenIssues,
  countStructuredIssues,
  type ChecklistSubmissionRow,
} from './checklistAnalytics'
import { listSubmissionPhotos } from '../services/photosService'
import { listAdminSubmissions } from '../services/submissionsService'
import {
  parseDailySafetyChecklist,
  type DailySafetyChecklist,
} from '../types/safetyChecklist'
import type { ReportIncludeOptions, SavedReportSummary } from '../types/savedReport'

function checkDateInPeriod(
  checklist: DailySafetyChecklist,
  year: number,
  month: number,
): boolean {
  const parts = checklist.checkDate.split('-').map(Number)
  if (parts.length < 2) return false
  const [y, m] = parts
  return y === year && m === month
}

export async function buildPeriodReportSummary(params: {
  siteId: string
  year: number
  month: number
  options: ReportIncludeOptions
}): Promise<{ summary: SavedReportSummary; rows: ChecklistSubmissionRow[] }> {
  const { siteId, year, month, options } = params
  const { data: all, error } = await listAdminSubmissions()
  if (error) {
    throw new Error(error)
  }

  const rows: ChecklistSubmissionRow[] = []
  for (const item of all) {
    if (item.site_id !== siteId || item.status === 'draft') continue
    const c = parseDailySafetyChecklist(item.checklist, item.created_at.slice(0, 10))
    if (!checkDateInPeriod(c, year, month)) continue
    rows.push({
      id: item.id,
      status: item.status,
      checklist: item.checklist,
      created_at: item.created_at,
      updated_at: item.updated_at,
      siteName: item.sites?.name ?? 'Unknown',
      workerName: item.submitter?.display_name ?? 'Unknown',
    })
  }

  const metrics = aggregateSafetyMetrics(rows)
  const openIssues = buildOpenIssues(rows)

  let photoCount = 0
  if (options.photos) {
    for (const row of rows) {
      const { data } = await listSubmissionPhotos(row.id)
      photoCount += data.length
    }
  }

  const issueLines = openIssues.slice(0, 12).map(
    (i) => `${i.siteName} · ${i.category}: ${i.summary}`,
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

  const summary: SavedReportSummary = {
    submissionCount: rows.length,
    avgCompliance: metrics.avgCompliance,
    hazardCount: metrics.hazardReports,
    incidentCount: metrics.incidents,
    openIssueCount: metrics.openIssueCount,
    issueLines,
    correctiveLines,
    photoCount,
    generatedAt: new Date().toISOString(),
  }

  return { summary, rows }
}
