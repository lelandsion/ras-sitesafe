import { jsPDF } from 'jspdf'
import type { SubmissionPhoto, SubmissionWithDetails } from '../types/database'
import { SUBMISSION_PHOTO_KIND_LABELS } from '../types/database'
import {
  HAZARD_SEVERITY_LABELS,
  parseDailySafetyChecklist,
  TRI_STATE_LABELS,
  type DailySafetyChecklist,
  type TriState,
} from '../types/safetyChecklist'
import { SUBMISSION_STATUS_LABELS } from '../types/database'
import { getPhotoSignedUrl } from '../services/photosService'

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

async function loadImageDataUrl(
  photo: SubmissionPhoto,
): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG' | 'WEBP' } | null> {
  const { url } = await getPhotoSignedUrl(photo.storage_path)
  if (!url) return null

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    const format =
      photo.content_type === 'image/png'
        ? 'PNG'
        : photo.content_type === 'image/webp'
          ? 'WEBP'
          : 'JPEG'
    return { dataUrl, format }
  } catch {
    return null
  }
}

function appendPhotoSection(
  doc: jsPDF,
  y: number,
  title: string,
  images: { dataUrl: string; format: 'JPEG' | 'PNG' | 'WEBP' }[],
): number {
  if (images.length === 0) return y

  y = line(doc, y, title, { bold: true, size: 11 })
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxW = 85
  const maxH = 60
  let col = 0

  for (const img of images) {
    if (y > pageHeight - maxH - 20) {
      doc.addPage()
      y = 16
      col = 0
    }
    const x = 14 + col * (maxW + 6)
    try {
      doc.addImage(img.dataUrl, img.format, x, y, maxW, maxH, undefined, 'FAST')
    } catch {
      y = line(doc, y + maxH, '  (Could not embed one photo.)')
      continue
    }
    col += 1
    if (col >= 2) {
      col = 0
      y += maxH + 8
    }
  }
  if (col !== 0) y += maxH + 8
  return y + 2
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
  photos?: SubmissionPhoto[]
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

export async function exportSubmissionToPdf(input: SubmissionPdfInput): Promise<void> {
  const { submission, photos = [], adminSummaryLines } = input
  const checklist = parseDailySafetyChecklist(
    submission.checklist,
    submission.created_at.slice(0, 10),
  )
  const siteName = submission.sites?.name ?? 'Unknown site'
  const worker =
    submission.submitter?.display_name ?? 'Field worker'

  const sitePhotos = photos.filter((p) => (p.photo_kind ?? 'site') === 'site')
  const hazardPhotos = photos.filter((p) => p.photo_kind === 'hazard')

  const siteImages: { dataUrl: string; format: 'JPEG' | 'PNG' | 'WEBP' }[] = []
  const hazardImages: { dataUrl: string; format: 'JPEG' | 'PNG' | 'WEBP' }[] = []

  for (const photo of sitePhotos) {
    const loaded = await loadImageDataUrl(photo)
    if (loaded) siteImages.push(loaded)
  }
  for (const photo of hazardPhotos) {
    const loaded = await loadImageDataUrl(photo)
    if (loaded) hazardImages.push(loaded)
  }

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

  if (y > 240) {
    doc.addPage()
    y = 16
  }

  y = appendPhotoSection(doc, y, SUBMISSION_PHOTO_KIND_LABELS.site, siteImages)
  y = appendPhotoSection(doc, y, SUBMISSION_PHOTO_KIND_LABELS.hazard, hazardImages)

  if (
    sitePhotos.length + hazardPhotos.length > 0 &&
    siteImages.length + hazardImages.length === 0
  ) {
    y = line(
      doc,
      y,
      `${sitePhotos.length + hazardPhotos.length} photo(s) on file (could not embed — open SiteSafe preview).`,
    )
  }

  doc.save(buildSubmissionPdfFilename(submission.id, siteName))
}
