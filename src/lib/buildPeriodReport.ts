import {
  buildPeriodIssues,
  type ChecklistSubmissionRow,
} from './checklistAnalytics'
import {
  buildAggregateSummary,
  demoAggregateFallback,
  filterSubmissionsForPeriod,
  monthBounds,
  normalizeCalendarDate,
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

function checklistAppendixForRow(row: ChecklistSubmissionRow): ReportAppendixIssue[] {
  return buildPeriodIssues([row]).map((i) => {
    const c = parseDailySafetyChecklist(
      row.checklist,
      normalizeCalendarDate(row.created_at),
    )
    return {
      date: c.checkDate,
      workerName: i.workerName,
      category: i.category,
      summary: i.summary,
      severity: i.severity,
      status: i.status,
    }
  })
}

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
  // Inclusive calendar-month (or custom) bounds in YYYY-MM-DD app date space.
  const fromDate = normalizeCalendarDate(params.fromDate ?? bounds.fromDate)
  const toDate = normalizeCalendarDate(params.toDate ?? bounds.toDate)
  const { siteId, options } = params

  const { data: all, error } = await listAdminSubmissions()
  if (error) {
    throw new Error(error)
  }

  // Period membership: site match + non-draft + checklist.checkDate in [from, to].
  const rows = filterSubmissionsForPeriod(all, {
    siteId,
    fromDate,
    toDate,
    siteNameFallback: params.siteName,
  })

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
      const c = parseDailySafetyChecklist(
        row.checklist,
        normalizeCalendarDate(row.created_at),
      )
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

  // Per submission: prefer DB safety_issue rows (all CA statuses + no-CA) when
  // present; otherwise keep checklist-derived issues. Do not drop checklist-only
  // rows just because another submission in the period has DB issues.
  const appendixIssues: ReportAppendixIssue[] = []
  for (const row of rows) {
    const { data, error: issuesError } = await listIssuesForSubmission(row.id)
    const c = parseDailySafetyChecklist(
      row.checklist,
      normalizeCalendarDate(row.created_at),
    )
    if (!issuesError && data.length > 0) {
      for (const issue of data) {
        const caStatus = issue.corrective_action?.status
        appendixIssues.push({
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
    } else {
      appendixIssues.push(...checklistAppendixForRow(row))
    }
  }

  return {
    summary: {
      ...summary,
      appendixPhotos: options.photos ? appendixPhotos : [],
      appendixIssues,
      safetyIssueCount: appendixIssues.length,
    },
    rows,
    usedDemoFallback: false,
  }
}
