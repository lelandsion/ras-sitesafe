import { jsPDF } from 'jspdf'
import type { SubmissionWithDetails } from '../types/database'
import {
  HAZARD_SEVERITY_LABELS,
  parseDailySafetyChecklist,
  TRI_STATE_LABELS,
  type DailySafetyChecklist,
  type TriState,
} from '../types/safetyChecklist'
import { SUBMISSION_STATUS_LABELS } from '../types/database'

function triLabel(v: TriState | null): string {
  if (!v) return '—'
  return TRI_STATE_LABELS[v]
}

function line(
  doc: jsPDF,
  y: number,
  text: string,
  opts?: { bold?: boolean; size?: number },
): number {
  const size = opts?.size ?? 10
  doc.setFontSize(size)
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  const lines = doc.splitTextToSize(text, 180)
  doc.text(lines, 14, y)
  return y + lines.length * (size * 0.45) + 2
}

function sectionTri(
  doc: jsPDF,
  y: number,
  title: string,
  items: [string, TriState | null][],
): number {
  y = line(doc, y, title, { bold: true, size: 11 })
  for (const [label, val] of items) {
    y = line(doc, y, `  • ${label}: ${triLabel(val)}`)
  }
  return y + 2
}

function renderChecklistBody(
  doc: jsPDF,
  y: number,
  checklist: DailySafetyChecklist,
): number {
  y = sectionTri(doc, y, 'PPE', [
    ['Hard hat', checklist.ppe.hardHat],
    ['High-vis vest', checklist.ppe.highVis],
    ['Footwear', checklist.ppe.footwear],
    ['Eye protection', checklist.ppe.eyeProtection],
  ])
  y = sectionTri(doc, y, 'Fall protection', [
    ['Edges / openings protected', checklist.fallProtection.edgesProtected],
    ['Fall protection in use', checklist.fallProtection.fpInUse],
    ['Ladders / access safe', checklist.fallProtection.ladders],
  ])
  y = sectionTri(doc, y, 'Tools & work area', [
    ['Tools / equipment condition', checklist.toolsAndWorkArea.toolsCondition],
    ['Work area clear', checklist.toolsAndWorkArea.workAreaClear],
    ['Housekeeping', checklist.toolsAndWorkArea.housekeeping],
  ])

  y = line(doc, y, 'Hazards', { bold: true, size: 11 })
  y = line(
    doc,
    y,
    `  Observed: ${checklist.hazards.present === null ? '—' : checklist.hazards.present ? 'Yes' : 'No'}`,
  )
  if (checklist.hazards.present) {
    y = line(doc, y, `  Description: ${checklist.hazards.description}`)
    y = line(
      doc,
      y,
      `  Severity: ${checklist.hazards.severity ? HAZARD_SEVERITY_LABELS[checklist.hazards.severity] : '—'}`,
    )
  }

  y = line(doc, y, 'Incident / near miss', { bold: true, size: 11 })
  y = line(
    doc,
    y,
    `  Occurred: ${checklist.incidentOrNearMiss.occurred === null ? '—' : checklist.incidentOrNearMiss.occurred ? 'Yes' : 'No'}`,
  )
  if (checklist.incidentOrNearMiss.occurred) {
    y = line(doc, y, `  Detail: ${checklist.incidentOrNearMiss.detail}`)
  }
  return y
}

export type SubmissionPdfInput = {
  submission: SubmissionWithDetails | {
    id: string
    status: SubmissionWithDetails['status']
    notes: string | null
    checklist: unknown
    created_at: string
    updated_at: string
    sites: SubmissionWithDetails['sites']
    submitter: SubmissionWithDetails['submitter']
  }
  photoCount?: number
  /** Optional admin summary block (metrics text lines). */
  adminSummaryLines?: string[]
}

export function buildSubmissionPdfFilename(
  submissionId: string,
  siteName?: string,
): string {
  const slug = (siteName ?? 'site')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `ras-sitesafe-daily-check-${slug}-${submissionId.slice(0, 8)}.pdf`
}

export function exportSubmissionToPdf(input: SubmissionPdfInput): void {
  const { submission, photoCount = 0, adminSummaryLines } = input
  const checklist = parseDailySafetyChecklist(
    submission.checklist,
    submission.created_at.slice(0, 10),
  )
  const siteName = submission.sites?.name ?? 'Unknown site'
  const worker =
    submission.submitter?.display_name ?? 'Field worker'

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 16

  doc.setTextColor(4, 83, 57)
  y = line(doc, y, 'RAS SiteSafe', { bold: true, size: 16 })
  doc.setTextColor(42, 40, 41)
  y = line(doc, y, 'DAILY SAFETY CHECK', { bold: true, size: 13 })
  y = line(doc, y, `Site: ${siteName}`)
  if (submission.sites?.address) {
    y = line(doc, y, submission.sites.address)
  }
  y = line(doc, y, `Check date: ${checklist.checkDate}`)
  y = line(doc, y, `Worker: ${worker}`)
  y = line(
    doc,
    y,
    `Status: ${SUBMISSION_STATUS_LABELS[submission.status]} · Updated ${new Date(submission.updated_at).toLocaleString()}`,
  )
  y += 4

  if (adminSummaryLines?.length) {
    y = line(doc, y, 'Site safety summary', { bold: true, size: 11 })
    for (const ln of adminSummaryLines) {
      y = line(doc, y, `  ${ln}`)
    }
    y += 2
  }

  y = renderChecklistBody(doc, y, checklist)

  if (submission.notes?.trim()) {
    y += 2
    y = line(doc, y, 'Additional notes', { bold: true, size: 11 })
    y = line(doc, y, submission.notes.trim())
  }

  if (photoCount > 0) {
    y += 2
    y = line(doc, y, `Photos attached: ${photoCount} (see SiteSafe app for images).`)
  }

  doc.save(buildSubmissionPdfFilename(submission.id, siteName))
}
