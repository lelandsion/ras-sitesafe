import { jsPDF } from 'jspdf'
import type { ReportIncludeOptions, SavedReportSummary } from '../types/savedReport'
import { periodLabel, safetyReportHeading } from '../types/savedReport'

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

function ensureSpace(doc: jsPDF, y: number, need = 20): number {
  if (y > 270 - need) {
    doc.addPage()
    return 16
  }
  return y
}

export function exportPeriodReportPdf(params: {
  siteName: string
  year: number
  month: number
  title: string
  options: ReportIncludeOptions
  summary: SavedReportSummary
}): void {
  const { siteName, year, month, options, summary } = params
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 16

  doc.setTextColor(4, 83, 57)
  y = line(doc, y, 'RAS SiteSafe', { bold: true, size: 16 })
  doc.setTextColor(42, 40, 41)
  y = line(doc, y, safetyReportHeading(siteName, year, month), {
    bold: true,
    size: 12,
  })
  y = line(doc, y, `Site: ${siteName}`)
  y = line(doc, y, `Period: ${periodLabel(year, month)}`)
  y = line(doc, y, `Generated: ${new Date(summary.generatedAt).toLocaleString()}`)
  y += 4

  if (options.submissionCompliance) {
    y = line(doc, y, 'Submission compliance', { bold: true, size: 11 })
    y = line(doc, y, `  Expected: ${summary.expectedSubmissions}${summary.expectedIsEstimate ? ' (estimated)' : ''}`)
    y = line(doc, y, `  Submitted: ${summary.submissionCount}`)
    y = line(doc, y, `  Missing: ${summary.missingSubmissions}`)
    y = line(
      doc,
      y,
      `  Completion: ${summary.completionPct !== null ? `${summary.completionPct}%` : '—'}`,
    )
    y += 2
  }

  if (options.safetySummary) {
    y = line(doc, y, 'Safety', { bold: true, size: 11 })
    y = line(doc, y, `  Safety issues: ${summary.safetyIssueCount}`)
    y = line(doc, y, `  High priority: ${summary.highPriorityCount}`)
    y = line(doc, y, `  Near misses: ${summary.nearMissCount}`)
    y = line(doc, y, `  Open issues: ${summary.openIssueCount}`)
    y = line(doc, y, `  Resolved: ${summary.resolvedIssueCount}`)
    y = line(
      doc,
      y,
      `  Avg checklist compliance: ${summary.avgCompliance !== null ? `${summary.avgCompliance}%` : '—'}`,
    )
    y += 2
  }

  if (options.safetyIssues) {
    y = line(doc, y, 'Top issues', { bold: true, size: 11 })
    for (const item of summary.topIssues) {
      y = line(doc, y, `  ${item.name}: ${item.count}`)
    }
    y += 2

    if (summary.notableIssues.length > 0) {
      y = ensureSpace(doc, y)
      y = line(doc, y, 'Notable issues', { bold: true, size: 11 })
      for (const ln of summary.notableIssues) {
        y = ensureSpace(doc, y)
        y = line(doc, y, `  • ${ln}`)
      }
      y += 2
    }
  }

  if (options.correctiveActions && summary.correctiveLines.length > 0) {
    y = ensureSpace(doc, y)
    y = line(doc, y, 'Corrective actions', { bold: true, size: 11 })
    for (const ln of summary.correctiveLines) {
      y = ensureSpace(doc, y)
      y = line(doc, y, `  • ${ln}`)
    }
    y += 2
  }

  if (options.photos) {
    y = ensureSpace(doc, y)
    y = line(doc, y, 'Photos', { bold: true, size: 11 })
    y = line(doc, y, `  ${summary.photoCount} photo(s) attached to checks in this period.`)
  }

  const slug = siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
  doc.save(`ras-sitesafe-monthly-${slug}-${year}-${String(month).padStart(2, '0')}.pdf`)
}
