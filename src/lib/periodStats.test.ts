import { describe, expect, it } from 'vitest'
import {
  buildAggregateSummary,
  countWeekdaysInclusive,
  estimateExpectedSubmissions,
  monthBounds,
  topNamedIssueCounts,
} from './periodStats'
import {
  emptyDailySafetyChecklist,
  serializeChecklist,
} from '../types/safetyChecklist'
import type { ChecklistSubmissionRow } from './checklistAnalytics'

function rowWithIssues(): ChecklistSubmissionRow {
  const c = emptyDailySafetyChecklist('2026-10-06')
  c.ppe.hardHat = 'no'
  c.ppe.highVis = 'yes'
  c.ppe.footwear = 'yes'
  c.ppe.eyeProtection = 'yes'
  c.fallProtection.edgesProtected = 'no'
  c.fallProtection.fpInUse = 'yes'
  c.fallProtection.ladders = 'yes'
  c.toolsAndWorkArea.toolsCondition = 'no'
  c.toolsAndWorkArea.workAreaClear = 'yes'
  c.toolsAndWorkArea.housekeeping = 'no'
  c.hazards = { present: true, description: 'Loose plank', severity: 'high' }
  c.incidentOrNearMiss = { occurred: true, detail: 'Near miss on scaffold' }
  return {
    id: 'sub-1',
    status: 'submitted',
    checklist: serializeChecklist(c),
    created_at: '2026-10-06T12:00:00Z',
    updated_at: '2026-10-06T12:00:00Z',
    siteName: 'Royal Commons',
    workerName: 'Daniel Ortiz',
  }
}

describe('periodStats', () => {
  it('counts weekdays inclusive for October 2026', () => {
    expect(countWeekdaysInclusive('2026-10-01', '2026-10-31')).toBe(22)
  })

  it('builds month bounds', () => {
    expect(monthBounds(2026, 10)).toEqual({
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    })
  })

  it('estimates expected from assignments × weekdays', () => {
    const result = estimateExpectedSubmissions({
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
      assignedFramerCount: 2,
      uniqueSubmitters: 1,
    })
    expect(result).toEqual({ expected: 44, estimated: false })
  })

  it('falls back to submitters when no assignments', () => {
    const result = estimateExpectedSubmissions({
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
      assignedFramerCount: 0,
      uniqueSubmitters: 1,
    })
    expect(result.estimated).toBe(true)
    expect(result.expected).toBe(22)
  })

  it('counts named top issues from checklist data', () => {
    const top = topNamedIssueCounts([rowWithIssues()])
    expect(top.find((t) => t.name === 'PPE')?.count).toBe(1)
    expect(top.find((t) => t.name === 'Fall Protection')?.count).toBe(1)
    expect(top.find((t) => t.name === 'Housekeeping')?.count).toBe(1)
    expect(top.find((t) => t.name === 'Tools')?.count).toBe(1)
  })

  it('builds aggregate summary with real checklist metrics', () => {
    const summary = buildAggregateSummary({
      rows: [rowWithIssues()],
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
      assignedFramerCount: 1,
      photoCount: 3,
    })
    expect(summary.submissionCount).toBe(1)
    expect(summary.expectedSubmissions).toBe(22)
    expect(summary.missingSubmissions).toBe(21)
    expect(summary.highPriorityCount).toBe(1)
    expect(summary.nearMissCount).toBe(1)
    expect(summary.openIssueCount).toBeGreaterThan(0)
    expect(summary.photoCount).toBe(3)
    expect(summary.topIssues.some((t) => t.count > 0)).toBe(true)
  })
})
