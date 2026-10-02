import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REPORT_INCLUDES,
  formatReportListDate,
  formatReportRangeLabel,
  periodLabel,
  safetyReportHeading,
} from './savedReport'

describe('savedReport labels', () => {
  it('formats period and list dates', () => {
    expect(periodLabel(2026, 10)).toMatch(/October.*2026/)
    expect(formatReportListDate('2026-10-02T12:00:00.000Z')).toMatch(/Oct/)
  })

  it('builds a safety report heading and range label', () => {
    expect(safetyReportHeading('Royal Commons', 2026, 10)).toMatch(
      /ROYAL COMMONS/,
    )
    expect(formatReportRangeLabel('2026-10-01', '2026-10-31')).toMatch(/Oct/)
  })

  it('defaults include all report sections', () => {
    expect(DEFAULT_REPORT_INCLUDES).toEqual({
      safetySummary: true,
      submissionCompliance: true,
      safetyIssues: true,
      correctiveActions: true,
      photos: true,
    })
  })
})
