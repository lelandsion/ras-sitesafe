import type { ChecklistSubmissionRow } from './checklistAnalytics'
import {
  buildAggregateSummary,
  checkDateInRange,
  demoAggregateFallback,
  monthBounds,
} from './periodStats'
import { listSubmissionPhotos } from '../services/photosService'
import { listIssuesForSubmission } from '../services/safetyIssuesService'
import { listSiteAssignments } from '../services/sitesService'
import { listAdminSubmissions } from '../services/submissionsService'
import { parseDailySafetyChecklist } from '../types/safetyChecklist'
import type {
  ReportAppendixIssue,
  ReportAppendixPhoto,
  ReportIncludeOptions,
  SavedReportSummary,
} from '../types/savedReport'

/** Cap photos stored on the summary / embedded in PDF to limit memory. */
export const APPENDIX_PHOTO_CAP = 24

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

  const appendixPhotos: ReportAppendixPhoto[] = []
  let photoCount = 0
  if (options.photos) {
    for (const row of rows) {
      const { data } = await listSubmissionPhotos(row.id)
      photoCount += data.length
      const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
      for (const photo of data) {
        if (appendixPhotos.length >= APPENDIX_PHOTO_CAP) break
        appendixPhotos.push({
          id: photo.id,
          submissionId: row.id,
          kind: photo.photo_kind ?? 'site',
          checkDate: c.checkDate,
          workerName: row.workerName,
          storagePath: photo.storage_path,
          contentType: photo.content_type,
        })
      }
      if (appendixPhotos.length >= APPENDIX_PHOTO_CAP) break
    }
  }

  if (rows.length === 0 && params.allowDemoFallback !== false) {
    const demo = demoAggregateFallback(params.siteName)
    return {
      summary: {
        ...demo,
        photoCount: options.photos ? demo.photoCount : 0,
        appendixPhotos: options.photos ? demo.appendixPhotos : [],
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

  // Prefer DB safety_issue rows (description / immediate action) when present.
  // Include every CA status: open, in_progress, ready_for_review, resolved
  // (and issues with no CA yet). Period membership uses checklist checkDate
  // via `rows` — not issue created_at / submission created_at alone.
  const dbAppendix: ReportAppendixIssue[] = []
  for (const row of rows) {
    const { data, error: issuesError } = await listIssuesForSubmission(row.id)
    if (issuesError || data.length === 0) continue
    const c = parseDailySafetyChecklist(row.checklist, row.created_at.slice(0, 10))
    for (const issue of data) {
      const caStatus = issue.corrective_action?.status
      dbAppendix.push({
        date: c.checkDate,
        workerName: row.workerName,
        category: issue.item_label || issue.checklist_item_key,
        summary: issue.description,
        severity: issue.severity,
        status: caStatus ?? row.status,
        description: issue.description,
        immediateAction: issue.immediate_action,
      })
    }
  }

  const appendixIssues =
    dbAppendix.length > 0 ? dbAppendix : summary.appendixIssues

  return {
    summary: {
      ...summary,
      appendixPhotos: options.photos ? appendixPhotos : [],
      appendixIssues,
      // Keep tile count aligned with appendix when DB rows are authoritative.
      safetyIssueCount:
        dbAppendix.length > 0 ? dbAppendix.length : summary.safetyIssueCount,
    },
    rows,
    usedDemoFallback: false,
  }
}
