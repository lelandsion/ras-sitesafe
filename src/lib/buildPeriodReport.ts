import type { ChecklistSubmissionRow } from './checklistAnalytics'
import {
  buildAggregateSummary,
  checkDateInRange,
  demoAggregateFallback,
  monthBounds,
} from './periodStats'
import { listSubmissionPhotos } from '../services/photosService'
import { listSiteAssignments } from '../services/sitesService'
import { listAdminSubmissions } from '../services/submissionsService'
import { parseDailySafetyChecklist } from '../types/safetyChecklist'
import type { ReportIncludeOptions, SavedReportSummary } from '../types/savedReport'

export async function buildPeriodReportSummary(params: {
  siteId: string
  siteName: string
  year: number
  month: number
  fromDate?: string
  toDate?: string
  options: ReportIncludeOptions
  /** When true and period has zero rows, fill demo stats for UX review. */
  allowDemoFallback?: boolean
}): Promise<{
  summary: SavedReportSummary
  rows: ChecklistSubmissionRow[]
  usedDemoFallback: boolean
}> {
  const bounds = monthBounds(params.year, params.month)
  const fromDate = params.fromDate ?? bounds.fromDate
  const toDate = params.toDate ?? bounds.toDate
  const { siteId, options } = params

  const { data: all, error } = await listAdminSubmissions()
  if (error) {
    throw new Error(error)
  }

  const rows: ChecklistSubmissionRow[] = []
  for (const item of all) {
    if (item.site_id !== siteId || item.status === 'draft') continue
    const c = parseDailySafetyChecklist(item.checklist, item.created_at.slice(0, 10))
    if (!checkDateInRange(c, fromDate, toDate)) continue
    rows.push({
      id: item.id,
      status: item.status,
      checklist: item.checklist,
      created_at: item.created_at,
      updated_at: item.updated_at,
      siteName: item.sites?.name ?? params.siteName,
      workerName: item.submitter?.display_name ?? 'Unknown',
    })
  }

  let assignedFramerCount = 0
  const assignResult = await listSiteAssignments(siteId)
  if (!assignResult.error) {
    assignedFramerCount = assignResult.data.length
  }

  let photoCount = 0
  if (options.photos) {
    for (const row of rows) {
      const { data } = await listSubmissionPhotos(row.id)
      photoCount += data.length
    }
  }

  if (rows.length === 0 && params.allowDemoFallback !== false) {
    const demo = demoAggregateFallback(params.siteName)
    return {
      summary: {
        ...demo,
        photoCount: options.photos ? demo.photoCount : 0,
        generatedAt: new Date().toISOString(),
      },
      rows,
      usedDemoFallback: true,
    }
  }

  const summary = buildAggregateSummary({
    rows,
    fromDate,
    toDate,
    assignedFramerCount,
    photoCount,
  })

  return { summary, rows, usedDemoFallback: false }
}
