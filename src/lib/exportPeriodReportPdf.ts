import { jsPDF } from 'jspdf'
import { getPhotoSignedUrl } from '../services/photosService'
import type {
  ReportAppendixPhoto,
  ReportIncludeOptions,
  SavedReportSummary,
} from '../types/savedReport'
import {
  formatReportRangeLabel,
  periodLabel,
  safetyReportHeading,
} from '../types/savedReport'

/** Max photos embedded in the PDF appendix (memory-safe). */
const PDF_APPENDIX_PHOTO_CAP = 18

const MARGIN = 14
const PAGE_W = 210
const CONTENT_W = PAGE_W - MARGIN * 2
const RAS_GREEN: [number, number, number] = [4, 83, 57]
const CHARCOAL: [number, number, number] = [42, 40, 41]
const MUTED: [number, number, number] = [90, 90, 90]
const ROW_ALT: [number, number, number] = [245, 247, 246]
const LINE: [number, number, number] = [210, 216, 212]

export type PeriodReportChartImage = {
  title: string
  dataUrl: string
  format?: 'PNG' | 'JPEG' | 'WEBP'
}

export type PeriodReportPdfInput = {
  siteName: string
  year: number
  month: number
  title: string
  options: ReportIncludeOptions
  summary: SavedReportSummary
  /** Optional date range for meta (defaults to calendar month). */
  fromDate?: string
  toDate?: string
  /** Optional pre-rendered chart images (PNG/JPEG data URLs). */
  chartImages?: PeriodReportChartImage[]
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - 14) {
    doc.addPage()
    return 16
  }
  return y
}

function drawHeaderBand(doc: jsPDF, siteName: string, period: string): number {
  doc.setFillColor(...RAS_GREEN)
  doc.rect(0, 0, PAGE_W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('RAS SiteSafe', MARGIN, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Monthly Safety Report', MARGIN, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const rightLines = doc.splitTextToSize(`${siteName}\n${period}`, 90)
  doc.text(rightLines, PAGE_W - MARGIN, 12, { align: 'right' })
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

function drawKeyValueTable(
  doc: jsPDF,
  y: number,
  title: string,
  rows: [string, string][],
): number {
  if (rows.length === 0) return y
  y = sectionTitle(doc, y, title)
  const col1 = 52
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

function drawDataTable(
  doc: jsPDF,
  y: number,
  title: string,
  headers: [string, string],
  rows: [string, string][],
): number {
  if (rows.length === 0) return y
  y = sectionTitle(doc, y, title)

  const col1 = CONTENT_W - 36
  const headerH = 7
  const rowH = 7
  const tableH = headerH + rows.length * rowH
  y = ensureSpace(doc, y, tableH + 4)

  doc.setFillColor(...RAS_GREEN)
  doc.rect(MARGIN, y, CONTENT_W, headerH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text(headers[0], MARGIN + 2, y + 4.8)
  doc.text(headers[1], MARGIN + CONTENT_W - 2, y + 4.8, { align: 'right' })

  let rowY = y + headerH
  rows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...ROW_ALT)
      doc.rect(MARGIN, rowY, CONTENT_W, rowH, 'F')
    }
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.25)
    doc.rect(MARGIN, rowY, CONTENT_W, rowH)
    doc.line(MARGIN + col1, rowY, MARGIN + col1, rowY + rowH)

    doc.setTextColor(...CHARCOAL)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const clipped = doc.splitTextToSize(label, col1 - 4)
    doc.text(clipped[0] ?? label, MARGIN + 2, rowY + 4.8)
    doc.setFont('helvetica', 'bold')
    doc.text(value, MARGIN + CONTENT_W - 2, rowY + 4.8, { align: 'right' })
    rowY += rowH
  })

  return rowY + 6
}

function drawBulletList(
  doc: jsPDF,
  y: number,
  title: string,
  items: string[],
): number {
  if (items.length === 0) return y
  y = sectionTitle(doc, y, title)

  for (const item of items) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...CHARCOAL)
    const lines = doc.splitTextToSize(`• ${item}`, CONTENT_W - 4)
    const blockH = lines.length * 4.5 + 3
    y = ensureSpace(doc, y, blockH)
    doc.setFillColor(...ROW_ALT)
    doc.rect(MARGIN, y, CONTENT_W, blockH, 'F')
    doc.setDrawColor(...LINE)
    doc.rect(MARGIN, y, CONTENT_W, blockH)
    doc.text(lines, MARGIN + 2, y + 4.5)
    y += blockH + 2
  }

  return y + 4
}

function drawNotesBlock(doc: jsPDF, y: number, title: string, body: string): number {
  y = sectionTitle(doc, y, title)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...CHARCOAL)
  const lines = doc.splitTextToSize(body, CONTENT_W - 4)
  const blockH = lines.length * 4.5 + 4
  y = ensureSpace(doc, y, blockH)
  doc.setFillColor(...ROW_ALT)
  doc.rect(MARGIN, y, CONTENT_W, blockH, 'F')
  doc.setDrawColor(...LINE)
  doc.rect(MARGIN, y, CONTENT_W, blockH)
  doc.text(lines, MARGIN + 2, y + 5)
  return y + blockH + 6
}

function appendChartImages(
  doc: jsPDF,
  y: number,
  images: PeriodReportChartImage[],
): number {
  if (images.length === 0) return y
  y = sectionTitle(doc, y, 'Charts')

  for (const img of images) {
    const maxW = CONTENT_W
    const maxH = 70
    y = ensureSpace(doc, y, maxH + 16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(img.title, MARGIN, y + 3)
    y += 6
    try {
      doc.setDrawColor(...LINE)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(MARGIN - 1, y - 1, maxW + 2, maxH + 2, 1.5, 1.5, 'FD')
      doc.addImage(
        img.dataUrl,
        img.format ?? 'PNG',
        MARGIN,
        y,
        maxW,
        maxH,
        undefined,
        'FAST',
      )
    } catch {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text('(Could not embed chart image)', MARGIN + 2, y + 8)
      doc.setTextColor(...CHARCOAL)
    }
    y += maxH + 8
  }

  return y
}

function drawChartTableFallbacks(
  doc: jsPDF,
  y: number,
  options: ReportIncludeOptions,
  summary: SavedReportSummary,
): number {
  const hasComplianceChart = options.submissionCompliance
  const hasIssuesChart = options.safetyIssues && summary.issuesSeries.length > 0
  const hasComplianceSeries =
    options.submissionCompliance && summary.complianceSeries.length > 0

  if (!hasComplianceChart && !hasIssuesChart && !hasComplianceSeries) {
    return y
  }

  if (hasComplianceChart) {
    y = drawDataTable(
      doc,
      y,
      'Compliance chart',
      ['Metric', 'Count'],
      [
        ['Expected', String(summary.expectedSubmissions)],
        ['Submitted', String(summary.submissionCount)],
        ['Missing', String(summary.missingSubmissions)],
      ],
    )
  }

  if (hasComplianceSeries) {
    y = drawDataTable(
      doc,
      y,
      'Checklist compliance trend',
      ['Date', '%'],
      summary.complianceSeries.map((row) => [
        row.date,
        String(row.compliance),
      ]),
    )
  }

  if (hasIssuesChart) {
    y = drawDataTable(
      doc,
      y,
      'Issues over time',
      ['Date', 'Issues'],
      summary.issuesSeries.map((row) => [row.date, String(row.issues)]),
    )
  }

  return y
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

type LoadedAppendixImage = {
  dataUrl: string
  format: 'JPEG' | 'PNG' | 'WEBP'
  label: string
}

async function loadAppendixImage(
  photo: ReportAppendixPhoto,
): Promise<LoadedAppendixImage | null> {
  const { url } = await getPhotoSignedUrl(photo.storagePath)
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    // Downscale via canvas when possible to keep PDF memory bounded.
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const raw = String(reader.result)
        if (typeof document === 'undefined') {
          resolve(raw)
          return
        }
        const img = new Image()
        img.onload = () => {
          const maxEdge = 640
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
          const w = Math.max(1, Math.round(img.width * scale))
          const h = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(raw)
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.72))
        }
        img.onerror = () => resolve(raw)
        img.src = raw
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    return {
      dataUrl,
      format: 'JPEG',
      label: `${photo.kind} · ${photo.checkDate} · ${photo.workerName}`,
    }
  } catch {
    return null
  }
}

function drawAppendixIssues(
  doc: jsPDF,
  y: number,
  summary: SavedReportSummary,
): number {
  const issues = summary.appendixIssues ?? []
  y = sectionTitle(doc, y, `Appendix — All safety issues (${issues.length})`)
  if (issues.length === 0) {
    return drawNotesBlock(doc, y, 'Issues', 'No safety issues in this period.')
  }

  for (const issue of issues) {
    const lines = [
      `${issue.date || '—'} · ${issue.workerName || '—'} · ${issue.category}`,
      issue.summary,
    ]
    if (issue.severity) lines.push(`Severity: ${issue.severity}`)
    if (issue.status) lines.push(`Status: ${issue.status.replace('_', ' ')}`)
    if (issue.immediateAction) {
      lines.push(`Immediate action: ${issue.immediateAction}`)
    }
    const body = lines.join('\n')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...CHARCOAL)
    const wrapped = doc.splitTextToSize(body, CONTENT_W - 4)
    const blockH = wrapped.length * 4.2 + 4
    y = ensureSpace(doc, y, blockH + 2)
    doc.setFillColor(...ROW_ALT)
    doc.rect(MARGIN, y, CONTENT_W, blockH, 'F')
    doc.setDrawColor(...LINE)
    doc.rect(MARGIN, y, CONTENT_W, blockH)
    doc.text(wrapped, MARGIN + 2, y + 4.5)
    y += blockH + 2
  }
  return y + 4
}

function drawAppendixPhotoGrid(
  doc: jsPDF,
  y: number,
  images: LoadedAppendixImage[],
  totalCount: number,
): number {
  y = sectionTitle(
    doc,
    y,
    `Appendix — Photos (${images.length}${totalCount > images.length ? ` of ${totalCount}` : ''})`,
  )
  if (images.length === 0) {
    return drawNotesBlock(doc, y, 'Photos', 'No photos could be embedded.')
  }

  const maxW = 88
  const maxH = 52
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
      doc.setFontSize(7)
      doc.setTextColor(...MUTED)
      const caption = doc.splitTextToSize(img.label, maxW - 2)
      doc.text(caption[0] ?? img.label, x + 1, y + maxH + 6)
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

export function buildPeriodReportPdfFilename(
  siteName: string,
  year: number,
  month: number,
): string {
  const slug = siteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
  return `ras-sitesafe-monthly-${slug}-${year}-${String(month).padStart(2, '0')}.pdf`
}

export async function exportPeriodReportPdf(
  params: PeriodReportPdfInput,
): Promise<void> {
  const {
    siteName,
    year,
    month,
    options,
    summary,
    fromDate,
    toDate,
    chartImages = [],
  } = params

  const period = periodLabel(year, month)
  const rangeLabel =
    fromDate && toDate
      ? formatReportRangeLabel(fromDate, toDate)
      : period

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = drawHeaderBand(doc, siteName, period)

  // Document heading under the brand band (matches AggregateReportView title).
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...CHARCOAL)
  const heading = safetyReportHeading(siteName, year, month)
  const headingLines = doc.splitTextToSize(heading, CONTENT_W)
  doc.text(headingLines, MARGIN, y)
  y += headingLines.length * 5 + 4

  y = drawMetaTable(doc, y, [
    ['Site', siteName],
    ['Period', period],
    ['Range', rangeLabel],
    [
      'Generated',
      new Date(summary.generatedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    ],
    ['Report', params.title || 'Monthly Safety Report'],
  ])

  if (options.submissionCompliance) {
    y = drawKeyValueTable(doc, y, 'Submission compliance', [
      [
        'Expected',
        `${summary.expectedSubmissions}${
          summary.expectedIsEstimate ? ' (estimated)' : ''
        }`,
      ],
      ['Submitted', String(summary.submissionCount)],
      ['Missing', String(summary.missingSubmissions)],
      [
        'Completion',
        summary.completionPct !== null ? `${summary.completionPct}%` : '—',
      ],
    ])
  }

  if (options.safetySummary) {
    const safetyRows: [string, string][] = [
      ['Safety issues', String(summary.safetyIssueCount)],
      ['High priority', String(summary.highPriorityCount)],
      ['Near misses', String(summary.nearMissCount)],
      ['Open issues', String(summary.openIssueCount)],
      ['Resolved', String(summary.resolvedIssueCount)],
      [
        'Avg checklist %',
        summary.avgCompliance !== null ? `${summary.avgCompliance}%` : '—',
      ],
    ]
    if (summary.hazardCount > 0) {
      safetyRows.push(['Hazards noted', String(summary.hazardCount)])
    }
    if (summary.incidentCount > 0) {
      safetyRows.push(['Incidents', String(summary.incidentCount)])
    }
    y = drawKeyValueTable(doc, y, 'Safety', safetyRows)
  }

  if (options.safetyIssues) {
    y = drawDataTable(
      doc,
      y,
      'Top issues',
      ['Category', 'Count'],
      summary.topIssues.map((item) => [item.name, String(item.count)]),
    )

    if (summary.notableIssues.length > 0) {
      y = drawBulletList(doc, y, 'Notable issues', summary.notableIssues)
    }

    if (summary.issueLines.length > 0 && summary.notableIssues.length === 0) {
      y = drawBulletList(doc, y, 'Issue detail', summary.issueLines)
    }
  }

  if (chartImages.length > 0) {
    y = appendChartImages(doc, y, chartImages)
  } else {
    y = drawChartTableFallbacks(doc, y, options, summary)
  }

  if (options.correctiveActions && summary.correctiveLines.length > 0) {
    y = drawBulletList(doc, y, 'Corrective actions', summary.correctiveLines)
  }

  if (options.photos) {
    y = drawNotesBlock(
      doc,
      y,
      'Photos',
      `${summary.photoCount} photo(s) attached to checks in this period. See Appendix for images.`,
    )
  }

  const wantAppendixIssues =
    options.safetyIssues && (summary.appendixIssues?.length ?? 0) > 0
  const wantAppendixPhotos =
    options.photos && (summary.appendixPhotos?.length ?? 0) > 0

  if (wantAppendixIssues || wantAppendixPhotos) {
    doc.addPage()
    y = 16
    y = sectionTitle(doc, y, 'Appendix')
  }

  if (wantAppendixIssues) {
    y = drawAppendixIssues(doc, y, summary)
  }

  if (wantAppendixPhotos) {
    const photos = (summary.appendixPhotos ?? []).slice(0, PDF_APPENDIX_PHOTO_CAP)
    const loaded: LoadedAppendixImage[] = []
    for (const photo of photos) {
      const img = await loadAppendixImage(photo)
      if (img) loaded.push(img)
    }
    y = drawAppendixPhotoGrid(doc, y, loaded, summary.photoCount)
  }

  drawFooter(doc)
  doc.save(buildPeriodReportPdfFilename(siteName, year, month))
}
