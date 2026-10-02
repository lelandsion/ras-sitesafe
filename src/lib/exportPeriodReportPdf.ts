import { jsPDF } from 'jspdf'
import type { ReportIncludeOptions, SavedReportSummary } from '../types/savedReport'
import { periodLabel } from '../types/savedReport'

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

export function exportPeriodReportPdf(params: {
  siteName: string
  year: number
  month: number
  title: string
  options: ReportIncludeOptions
  summary: SavedReportSummary
}): void {
  const { siteName, year, month, title, options, summary } = params
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 16

  doc.setTextColor(4, 83, 57)
  y = line(doc, y, 'RAS SiteSafe', { bold: true, size: 16 })
  doc.setTextColor(42, 40, 41)
  y = line(doc, y, title, { bold: true, size: 13 })
  y = line(doc, y, `Site: ${siteName}`)
  y = line(doc, y, `Period: ${periodLabel(year, month)}`)
  y = line(doc, y, `Generated: ${new Date(summary.generatedAt).toLocaleString()}`)
  y += 4

  if (options.safetySummary) {
    y = line(doc, y, 'Safety summary', { bold: true, size: 11 })
    y = line(doc, y, `  Daily checks in period: ${summary.submissionCount}`)
    y = line(
      doc,
      y,
      `  Avg compliance: ${summary.avgCompliance !== null ? `${summary.avgCompliance}%` : '—'}`,
    )
    y = line(doc, y, `  Hazard reports: ${summary.hazardCount}`)
    y = line(doc, y, `  Incidents / near misses: ${summary.incidentCount}`)
    y += 2
  }

  if (options.submissionCompliance) {
    y = line(doc, y, 'Submission compliance', { bold: true, size: 11 })
    y = line(doc, y, `  Non-draft checks logged: ${summary.submissionCount}`)
    y = line(
      doc,
      y,
      `  Open structured issues: ${summary.openIssueCount}`,
    )
    y += 2
  }

  if (options.safetyIssues && summary.issueLines.length > 0) {
    y = line(doc, y, 'Safety issues', { bold: true, size: 11 })
    for (const ln of summary.issueLines) {
      y = line(doc, y, `  • ${ln}`)
      if (y > 270) {
        doc.addPage()
        y = 16
      }
    }
    y += 2
  }

  if (options.correctiveActions && summary.correctiveLines.length > 0) {
    y = line(doc, y, 'Corrective actions', { bold: true, size: 11 })
    for (const ln of summary.correctiveLines) {
      y = line(doc, y, `  • ${ln}`)
    }
    y += 2
  }

  if (options.photos) {
    y = line(doc, y, 'Photos', { bold: true, size: 11 })
    y = line(doc, y, `  ${summary.photoCount} photo(s) attached to checks in this period.`)
  }

  const slug = siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
  doc.save(`ras-sitesafe-monthly-${slug}-${year}-${String(month).padStart(2, '0')}.pdf`)
}
