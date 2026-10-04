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

const MARGIN = 14
const PAGE_W = 210
const CONTENT_W = PAGE_W - MARGIN * 2
const RAS_GREEN: [number, number, number] = [4, 83, 57]
const CHARCOAL: [number, number, number] = [42, 40, 41]
const MUTED: [number, number, number] = [90, 90, 90]
const ROW_ALT: [number, number, number] = [245, 247, 246]
const LINE: [number, number, number] = [210, 216, 212]

type LoadedImage = { dataUrl: string; format: 'JPEG' | 'PNG' | 'WEBP' }

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - 14) {
    doc.addPage()
    return 16
  }
  return y
}

function drawHeaderBand(doc: jsPDF, siteName: string): number {
  doc.setFillColor(...RAS_GREEN)
  doc.rect(0, 0, PAGE_W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('RAS SiteSafe', MARGIN, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Daily Safety Check', MARGIN, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const siteLines = doc.splitTextToSize(siteName, 90)
  doc.text(siteLines, PAGE_W - MARGIN, 12, { align: 'right' })
  doc.setTextColor(...CHARCOAL)
  return 36
}

function drawMetaTable(
  doc: jsPDF,
  y: number,
  rows: [string, string][],
): number {
  const col1 = 38
  const rowH = 7
  const tableH = rows.length * rowH

  y = ensureSpace(doc, y, tableH + 4)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, tableH)

  rows.forEach(([label, value], i) => {
    const rowY = y + i * rowH
    if (i % 2 === 1) {
      doc.setFillColor(...ROW_ALT)
      doc.rect(MARGIN, rowY, CONTENT_W, rowH, 'F')
    }
    doc.setDrawColor(...LINE)
    doc.line(MARGIN, rowY + rowH, MARGIN + CONTENT_W, rowY + rowH)
    doc.line(MARGIN + col1, rowY, MARGIN + col1, rowY + rowH)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(label, MARGIN + 2, rowY + 4.8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...CHARCOAL)
    const valueLines = doc.splitTextToSize(value, CONTENT_W - col1 - 4)
    doc.text(valueLines[0] ?? '—', MARGIN + col1 + 2, rowY + 4.8)
  })

  return y + tableH + 6
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  y = ensureSpace(doc, y, 12)
  doc.setFillColor(...RAS_GREEN)
  doc.rect(MARGIN, y, 2.2, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...RAS_GREEN)
  doc.text(title, MARGIN + 5, y + 5)
  doc.setTextColor(...CHARCOAL)
  return y + 10
}

function markFor(v: TriState | null, col: 'yes' | 'no' | 'na'): string {
  // Helvetica has no reliable check glyph — use a solid X in the selected cell.
  if (!v) return ''
  if (col === 'yes' && v === 'yes') return 'X'
  if (col === 'no' && v === 'no') return 'X'
  if (col === 'na' && v === 'na') return 'X'
  return ''
}

function drawChecklistTable(
  doc: jsPDF,
  y: number,
  title: string,
  items: [string, TriState | null][],
): number {
  y = sectionTitle(doc, y, title)

  const colItem = CONTENT_W - 54
  const colW = 18
  const headerH = 7
  const rowH = 7
  const tableH = headerH + items.length * rowH

  y = ensureSpace(doc, y, tableH + 4)

  // Header
  doc.setFillColor(...RAS_GREEN)
  doc.rect(MARGIN, y, CONTENT_W, headerH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Item', MARGIN + 2, y + 4.8)
  doc.text('Yes', MARGIN + colItem + colW * 0.5, y + 4.8, { align: 'center' })
  doc.text('No', MARGIN + colItem + colW * 1.5, y + 4.8, { align: 'center' })
  doc.text('N/A', MARGIN + colItem + colW * 2.5, y + 4.8, { align: 'center' })

  let rowY = y + headerH
  items.forEach(([label, val], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...ROW_ALT)
      doc.rect(MARGIN, rowY, CONTENT_W, rowH, 'F')
    }
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.25)
    doc.rect(MARGIN, rowY, CONTENT_W, rowH)
    doc.line(MARGIN + colItem, rowY, MARGIN + colItem, rowY + rowH)
    doc.line(MARGIN + colItem + colW, rowY, MARGIN + colItem + colW, rowY + rowH)
    doc.line(
      MARGIN + colItem + colW * 2,
      rowY,
      MARGIN + colItem + colW * 2,
      rowY + rowH,
    )

    doc.setTextColor(...CHARCOAL)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(label, MARGIN + 2, rowY + 4.8)

    const cols: Array<'yes' | 'no' | 'na'> = ['yes', 'no', 'na']
    cols.forEach((col, colIdx) => {
      const mark = markFor(val, col)
      const cx = MARGIN + colItem + colW * (colIdx + 0.5)
      if (mark) {
        doc.setFillColor(...RAS_GREEN)
        doc.rect(
          MARGIN + colItem + colW * colIdx + 1,
          rowY + 1,
          colW - 2,
          rowH - 2,
          'F',
        )
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(mark, cx, rowY + 5, { align: 'center' })
        doc.setTextColor(...CHARCOAL)
      }
    })

    if (!val) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text('—', MARGIN + colItem + colW * 1.5, rowY + 4.8, {
        align: 'center',
      })
      doc.setTextColor(...CHARCOAL)
    }

    rowY += rowH
  })

  return rowY + 6
}

function drawKeyValueTable(
  doc: jsPDF,
  y: number,
  title: string,
  rows: [string, string][],
): number {
  y = sectionTitle(doc, y, title)
  const col1 = 42
  const rowH = 7
  const tableH = rows.length * rowH
  y = ensureSpace(doc, y, tableH + 4)

  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, tableH)

  rows.forEach(([label, value], i) => {
    const rowY = y + i * rowH
    if (i % 2 === 1) {
      doc.setFillColor(...ROW_ALT)
      doc.rect(MARGIN, rowY, CONTENT_W, rowH, 'F')
    }
    doc.line(MARGIN, rowY + rowH, MARGIN + CONTENT_W, rowY + rowH)
    doc.line(MARGIN + col1, rowY, MARGIN + col1, rowY + rowH)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(label, MARGIN + 2, rowY + 4.8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...CHARCOAL)
    const clipped = doc.splitTextToSize(value || '—', CONTENT_W - col1 - 4)
    doc.text(clipped[0] ?? '—', MARGIN + col1 + 2, rowY + 4.8)
  })

  return y + tableH + 6
}

function drawNotesBlock(doc: jsPDF, y: number, title: string, body: string): number {
  y = sectionTitle(doc, y, title)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...CHARCOAL)
  const lines = doc.splitTextToSize(body, CONTENT_W)
  const blockH = lines.length * 4.5 + 4
  y = ensureSpace(doc, y, blockH)
  doc.setFillColor(...ROW_ALT)
  doc.rect(MARGIN, y, CONTENT_W, blockH, 'F')
  doc.setDrawColor(...LINE)
  doc.rect(MARGIN, y, CONTENT_W, blockH)
  doc.text(lines, MARGIN + 2, y + 5)
  return y + blockH + 6
}

function renderChecklistBody(
  doc: jsPDF,
  y: number,
  checklist: DailySafetyChecklist,
): number {
  y = drawChecklistTable(doc, y, 'PPE', [
    ['Hard hat', checklist.ppe.hardHat],
    ['High-vis vest', checklist.ppe.highVis],
    ['Footwear', checklist.ppe.footwear],
    ['Eye protection', checklist.ppe.eyeProtection],
  ])
  y = drawChecklistTable(doc, y, 'Fall protection', [
    ['Edges / openings protected', checklist.fallProtection.edgesProtected],
    ['Fall protection in use', checklist.fallProtection.fpInUse],
    ['Ladders / access safe', checklist.fallProtection.ladders],
  ])
  y = drawChecklistTable(doc, y, 'Tools & work area', [
    ['Tools / equipment condition', checklist.toolsAndWorkArea.toolsCondition],
    ['Work area clear', checklist.toolsAndWorkArea.workAreaClear],
    ['Housekeeping', checklist.toolsAndWorkArea.housekeeping],
  ])

  const hazardRows: [string, string][] = [
    [
      'Observed',
      checklist.hazards.present === null
        ? '—'
        : checklist.hazards.present
          ? 'Yes'
          : 'No',
    ],
  ]
  if (checklist.hazards.present) {
    hazardRows.push(['Description', checklist.hazards.description || '—'])
    hazardRows.push([
      'Severity',
      checklist.hazards.severity
        ? HAZARD_SEVERITY_LABELS[checklist.hazards.severity]
        : '—',
    ])
  }
  y = drawKeyValueTable(doc, y, 'Hazards', hazardRows)

  const incidentRows: [string, string][] = [
    [
      'Occurred',
      checklist.incidentOrNearMiss.occurred === null
        ? '—'
        : checklist.incidentOrNearMiss.occurred
          ? 'Yes'
          : 'No',
    ],
  ]
  if (checklist.incidentOrNearMiss.occurred) {
    incidentRows.push([
      'Detail',
      checklist.incidentOrNearMiss.detail || '—',
    ])
  }
  y = drawKeyValueTable(doc, y, 'Incident / near miss', incidentRows)

  return y
}

async function loadImageDataUrl(
  photo: SubmissionPhoto,
): Promise<LoadedImage | null> {
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
  images: LoadedImage[],
): number {
  if (images.length === 0) return y

  y = sectionTitle(doc, y, title)
  const maxW = 88
  const maxH = 58
  const gap = 6
  let col = 0

  for (let i = 0; i < images.length; i += 1) {
    const img = images[i]
    y = ensureSpace(doc, y, maxH + 14)
    const x = MARGIN + col * (maxW + gap)
    try {
      doc.setDrawColor(...LINE)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(x - 1, y - 1, maxW + 2, maxH + 10, 1.5, 1.5, 'FD')
      doc.addImage(img.dataUrl, img.format, x, y, maxW, maxH, undefined, 'FAST')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...MUTED)
      doc.text(`Photo ${i + 1}`, x + 1, y + maxH + 6)
      doc.setTextColor(...CHARCOAL)
    } catch {
      doc.setFontSize(8)
      doc.text('(Could not embed photo)', x, y + 8)
    }
    col += 1
    if (col >= 2) {
      col = 0
      y += maxH + 14
    }
  }
  if (col !== 0) y += maxH + 14
  return y + 2
}

function drawFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, pageHeight - 10, PAGE_W - MARGIN, pageHeight - 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('RAS SiteSafe · Confidential jobsite record', MARGIN, pageHeight - 5)
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, pageHeight - 5, {
      align: 'right',
    })
  }
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

/** Exported for tests — maps tri-state to display label. */
export function triLabel(v: TriState | null): string {
  if (!v) return '—'
  return TRI_STATE_LABELS[v]
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
  const issuePhotos = photos.filter((p) => p.photo_kind === 'issue')

  const siteImages: LoadedImage[] = []
  const hazardImages: LoadedImage[] = []
  const issueImages: LoadedImage[] = []

  for (const photo of sitePhotos) {
    const loaded = await loadImageDataUrl(photo)
    if (loaded) siteImages.push(loaded)
  }
  for (const photo of hazardPhotos) {
    const loaded = await loadImageDataUrl(photo)
    if (loaded) hazardImages.push(loaded)
  }
  for (const photo of issuePhotos) {
    const loaded = await loadImageDataUrl(photo)
    if (loaded) issueImages.push(loaded)
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = drawHeaderBand(doc, siteName)

  y = drawMetaTable(doc, y, [
    ['Site', siteName],
    ['Address', submission.sites?.address?.trim() || '—'],
    ['Check date', checklist.checkDate],
    ['Worker', worker],
    ['Status', SUBMISSION_STATUS_LABELS[submission.status]],
    [
      'Updated',
      new Date(submission.updated_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    ],
  ])

  if (adminSummaryLines?.length) {
    y = drawKeyValueTable(
      doc,
      y,
      'Site safety summary',
      adminSummaryLines.map((ln, i) => [`Note ${i + 1}`, ln]),
    )
  }

  y = renderChecklistBody(doc, y, checklist)

  if (submission.notes?.trim()) {
    y = drawNotesBlock(doc, y, 'Additional notes', submission.notes.trim())
  }

  y = appendPhotoSection(doc, y, SUBMISSION_PHOTO_KIND_LABELS.site, siteImages)
  y = appendPhotoSection(doc, y, SUBMISSION_PHOTO_KIND_LABELS.hazard, hazardImages)
  y = appendPhotoSection(doc, y, SUBMISSION_PHOTO_KIND_LABELS.issue, issueImages)

  const photoTotal = sitePhotos.length + hazardPhotos.length + issuePhotos.length
  const imageTotal = siteImages.length + hazardImages.length + issueImages.length
  if (photoTotal > 0 && imageTotal === 0) {
    y = ensureSpace(doc, y, 10)
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(
      `${photoTotal} photo(s) on file (could not embed — open SiteSafe preview).`,
      MARGIN,
      y,
    )
  }

  drawFooter(doc)
  doc.save(buildSubmissionPdfFilename(submission.id, siteName))
}
