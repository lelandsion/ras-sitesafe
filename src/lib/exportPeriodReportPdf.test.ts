import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedReportSummary } from '../types/savedReport'
import { DEFAULT_REPORT_INCLUDES } from '../types/savedReport'
import { exportPeriodReportPdf } from './exportPeriodReportPdf'

const textCalls: string[] = []
const saveMock = vi.fn()

vi.mock('jspdf', () => {
  class MockJsPDF {
    setTextColor() {}
    setFontSize() {}
    setFont() {}
    splitTextToSize(text: string) {
      return [text]
    }
    text(value: string | string[]) {
      textCalls.push(Array.isArray(value) ? value.join(' ') : value)
    }
    addPage() {}
    save(name: string) {
      saveMock(name)
    }
  }
  return { jsPDF: MockJsPDF }
})

const summary: SavedReportSummary = {
  submissionCount: 8,
  avgCompliance: 92,
  hazardCount: 2,
  incidentCount: 1,
  openIssueCount: 3,
  issueLines: ['PPE: Hard hat No'],
  correctiveLines: ['Replace damaged hard hat'],
  photoCount: 5,
  generatedAt: '2026-10-02T18:00:00.000Z',
  expectedSubmissions: 10,
  missingSubmissions: 2,
  completionPct: 80,
  expectedIsEstimate: false,
  safetyIssueCount: 4,
  highPriorityCount: 1,
  nearMissCount: 1,
  resolvedIssueCount: 1,
  topIssues: [
    { name: 'PPE', count: 2 },
    { name: 'Fall Protection', count: 1 },
    { name: 'Housekeeping', count: 1 },
    { name: 'Tools', count: 0 },
  ],
  complianceSeries: [],
  issuesSeries: [],
  notableIssues: ['Loose sheathing on east elevation'],
}

describe('exportPeriodReportPdf', () => {
  beforeEach(() => {
    textCalls.length = 0
    saveMock.mockReset()
  })

  it('includes enabled report sections and omits disabled ones', () => {
    exportPeriodReportPdf({
      siteName: 'Royal Commons',
      year: 2026,
      month: 10,
      title: 'October safety report',
      options: DEFAULT_REPORT_INCLUDES,
      summary,
    })

    const joined = textCalls.join('\n')
    expect(joined).toMatch(/RAS SiteSafe/)
    expect(joined).toMatch(/Royal Commons/)
    expect(joined).toMatch(/Submission compliance/)
    expect(joined).toMatch(/Safety/)
    expect(joined).toMatch(/Top issues/)
    expect(joined).toMatch(/Notable issues/)
    expect(joined).toMatch(/Corrective actions/)
    expect(joined).toMatch(/Photos/)
    expect(saveMock).toHaveBeenCalledWith(
      'ras-sitesafe-monthly-royal-commons-2026-10.pdf',
    )

    textCalls.length = 0
    saveMock.mockReset()

    exportPeriodReportPdf({
      siteName: 'Royal Commons',
      year: 2026,
      month: 10,
      title: 'Slim report',
      options: {
        ...DEFAULT_REPORT_INCLUDES,
        photos: false,
        correctiveActions: false,
        safetyIssues: false,
      },
      summary,
    })

    const slim = textCalls.join('\n')
    expect(slim).toMatch(/Submission compliance/)
    expect(slim).not.toMatch(/Top issues/)
    expect(slim).not.toMatch(/Corrective actions/)
    expect(slim).not.toMatch(/^Photos$|Photos\n/)
  })
})
