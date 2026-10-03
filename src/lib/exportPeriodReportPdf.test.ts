import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedReportSummary } from '../types/savedReport'
import { DEFAULT_REPORT_INCLUDES } from '../types/savedReport'
import {
  buildPeriodReportPdfFilename,
  exportPeriodReportPdf,
} from './exportPeriodReportPdf'

const textCalls: string[] = []
const saveMock = vi.fn()
const rectCalls: Array<{ fill?: boolean }> = []
const addImageMock = vi.fn()
const addPageMock = vi.fn()

vi.mock('jspdf', () => {
  class MockJsPDF {
    internal = {
      pageSize: {
        getHeight: () => 297,
        getWidth: () => 210,
      },
    }
    setFillColor() {}
    setTextColor() {}
    setFontSize() {}
    setFont() {}
    setDrawColor() {}
    setLineWidth() {}
    rect(_x: number, _y: number, _w: number, _h: number, style?: string) {
      rectCalls.push({ fill: style === 'F' || style === 'FD' })
    }
    roundedRect() {}
    line() {}
    addPage() {
      addPageMock()
    }
    addImage(...args: unknown[]) {
      addImageMock(...args)
    }
    splitTextToSize(text: string) {
      return [text]
    }
    text(value: string | string[]) {
      textCalls.push(Array.isArray(value) ? value.join(' ') : value)
    }
    getNumberOfPages() {
      return 1
    }
    setPage() {}
    save(name: string) {
      saveMock(name)
    }
  }
  return { jsPDF: MockJsPDF }
})

vi.mock('../services/photosService', () => ({
  getPhotoSignedUrl: vi.fn(async () => ({ url: null, error: null })),
}))

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
  complianceSeries: [
    { date: '2026-10-01', compliance: 90 },
    { date: '2026-10-02', compliance: 94 },
  ],
  issuesSeries: [
    { date: '2026-10-01', issues: 1 },
    { date: '2026-10-02', issues: 2 },
  ],
  notableIssues: ['Loose sheathing on east elevation'],
  appendixIssues: [
    {
      date: '2026-10-01',
      workerName: 'Alex',
      category: 'PPE',
      summary: 'Hard hat: No',
      severity: null,
      status: 'submitted',
    },
    {
      date: '2026-10-02',
      workerName: 'Sam',
      category: 'Hazard',
      summary: 'Loose sheathing on east elevation',
      severity: 'high',
      status: 'under_review',
      immediateAction: 'Cordoned area',
    },
  ],
  appendixPhotos: [
    {
      id: 'p1',
      submissionId: 's1',
      kind: 'site',
      checkDate: '2026-10-01',
      workerName: 'Alex',
      storagePath: 'u/s1/a.jpg',
      contentType: 'image/jpeg',
    },
  ],
}

describe('exportPeriodReportPdf', () => {
  beforeEach(() => {
    textCalls.length = 0
    rectCalls.length = 0
    saveMock.mockReset()
    addImageMock.mockReset()
    addPageMock.mockReset()
  })

  it('builds a branded filename', () => {
    expect(buildPeriodReportPdfFilename('Royal Commons', 2026, 10)).toBe(
      'ras-sitesafe-monthly-royal-commons-2026-10.pdf',
    )
  })

  it('renders branded header, meta, sections, chart tables, appendix, and confidential footer', async () => {
    await exportPeriodReportPdf({
      siteName: 'Royal Commons',
      year: 2026,
      month: 10,
      title: 'Monthly Safety Report',
      options: DEFAULT_REPORT_INCLUDES,
      summary,
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    })

    const joined = textCalls.join('\n')
    expect(joined).toMatch(/RAS SiteSafe/)
    expect(joined).toMatch(/Monthly Safety Report/)
    expect(joined).toMatch(/ROYAL COMMONS/)
    expect(joined).toMatch(/Site/)
    expect(joined).toMatch(/Period/)
    expect(joined).toMatch(/Range/)
    expect(joined).toMatch(/Generated/)
    expect(joined).toMatch(/Submission compliance/)
    expect(joined).toMatch(/Expected/)
    expect(joined).toMatch(/Submitted/)
    expect(joined).toMatch(/Missing/)
    expect(joined).toMatch(/Completion/)
    expect(joined).toMatch(/Safety/)
    expect(joined).toMatch(/Safety issues/)
    expect(joined).toMatch(/High priority/)
    expect(joined).toMatch(/Near misses/)
    expect(joined).toMatch(/Top issues/)
    expect(joined).toMatch(/PPE/)
    expect(joined).toMatch(/Fall Protection/)
    expect(joined).toMatch(/Notable issues/)
    expect(joined).toMatch(/Loose sheathing/)
    expect(joined).toMatch(/Compliance chart/)
    expect(joined).toMatch(/Checklist compliance trend/)
    expect(joined).toMatch(/Issues over time/)
    expect(joined).toMatch(/Corrective actions/)
    expect(joined).toMatch(/Replace damaged hard hat/)
    expect(joined).toMatch(/Photos/)
    expect(joined).toMatch(/5 photo\(s\)/)
    expect(joined).toMatch(/Appendix/)
    expect(joined).toMatch(/All safety issues/)
    expect(joined).toMatch(/Hard hat: No/)
    expect(joined).toMatch(/Immediate action: Cordoned area/)
    expect(joined).toMatch(/Appendix — Photos/)
    expect(joined).toMatch(/Confidential jobsite record/)
    expect(joined).toMatch(/Page 1 of 1/)
    expect(addPageMock).toHaveBeenCalled()
    expect(rectCalls.some((r) => r.fill)).toBe(true)
    expect(saveMock).toHaveBeenCalledWith(
      'ras-sitesafe-monthly-royal-commons-2026-10.pdf',
    )
  })

  it('embeds chart images when provided and skips table chart fallbacks', async () => {
    await exportPeriodReportPdf({
      siteName: 'Royal Commons',
      year: 2026,
      month: 10,
      title: 'Monthly Safety Report',
      options: DEFAULT_REPORT_INCLUDES,
      summary,
      chartImages: [
        {
          title: 'Compliance chart',
          dataUrl: 'data:image/png;base64,aaa',
          format: 'PNG',
        },
      ],
    })

    const joined = textCalls.join('\n')
    expect(joined).toMatch(/Charts/)
    expect(joined).toMatch(/Compliance chart/)
    expect(joined).not.toMatch(/Checklist compliance trend/)
    expect(addImageMock).toHaveBeenCalled()
  })

  it('omits disabled report sections', async () => {
    await exportPeriodReportPdf({
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
    expect(slim).toMatch(/Safety/)
    expect(slim).not.toMatch(/Top issues/)
    expect(slim).not.toMatch(/Notable issues/)
    expect(slim).not.toMatch(/Corrective actions/)
    expect(slim).not.toMatch(/Photos/)
    expect(slim).not.toMatch(/Appendix/)
  })
})
