import { describe, expect, it } from 'vitest'
import {
  buildAggregateSummary,
  checkDateInRange,
  countWeekdaysInclusive,
  estimateExpectedSubmissions,
  filterSubmissionsForPeriod,
  monthBounds,
  normalizeCalendarDate,
  topNamedIssueCounts,
  type PeriodSubmissionSource,
} from './periodStats'
import {
  emptyDailySafetyChecklist,
  parseDailySafetyChecklist,
  serializeChecklist,
} from '../types/safetyChecklist'
import type { ChecklistSubmissionRow } from './checklistAnalytics'
import { localDateISO } from './dailyCompliance'

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

function source(overrides: {
  id: string
  checkDate: string
  status?: PeriodSubmissionSource['status']
  siteId?: string
  created_at?: string
}): PeriodSubmissionSource {
  const c = emptyDailySafetyChecklist(overrides.checkDate)
  return {
    id: overrides.id,
    site_id: overrides.siteId ?? 'site-a',
    status: overrides.status ?? 'submitted',
    checklist: serializeChecklist(c),
    created_at: overrides.created_at ?? `${overrides.checkDate}T18:00:00.000Z`,
    updated_at: overrides.created_at ?? `${overrides.checkDate}T18:00:00.000Z`,
    sites: { name: 'Cobble Hill' },
    submitter: { display_name: 'Leland' },
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
    expect(summary.appendixIssues.length).toBe(summary.safetyIssueCount)
    expect(summary.appendixIssues.length).toBe(summary.openIssueCount)
    expect(summary.appendixPhotos).toEqual([])
  })

  it('includes Reviewed (approved) issues in appendix and safetyIssueCount', () => {
    const approved = { ...rowWithIssues(), id: 'sub-approved', status: 'approved' as const }
    const summary = buildAggregateSummary({
      rows: [approved],
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
      assignedFramerCount: 1,
      photoCount: 0,
    })
    expect(summary.openIssueCount).toBe(0)
    expect(summary.appendixIssues.length).toBeGreaterThan(0)
    expect(summary.safetyIssueCount).toBe(summary.appendixIssues.length)
    expect(summary.appendixIssues.every((i) => i.status === 'approved')).toBe(true)
  })

  it('normalizes plain checkDate without UTC day-shift', () => {
    expect(normalizeCalendarDate('2026-10-03')).toBe('2026-10-03')
    expect(normalizeCalendarDate('2026-10-02')).toBe('2026-10-02')
  })

  it('maps timestamp fallbacks to the local calendar day', () => {
    // Instant that is still Oct 2 evening in US Pacific, Oct 3 in UTC.
    const eveningPtAsUtc = '2026-10-03T01:30:00.000Z'
    const local = localDateISO(new Date(eveningPtAsUtc))
    expect(normalizeCalendarDate(eveningPtAsUtc)).toBe(local)
  })

  it('checkDateInRange is inclusive on both ends for October', () => {
    const oct1 = parseDailySafetyChecklist(
      serializeChecklist(emptyDailySafetyChecklist('2026-10-01')),
    )
    const oct2 = parseDailySafetyChecklist(
      serializeChecklist(emptyDailySafetyChecklist('2026-10-02')),
    )
    const oct3 = parseDailySafetyChecklist(
      serializeChecklist(emptyDailySafetyChecklist('2026-10-03')),
    )
    const oct31 = parseDailySafetyChecklist(
      serializeChecklist(emptyDailySafetyChecklist('2026-10-31')),
    )
    const sep30 = parseDailySafetyChecklist(
      serializeChecklist(emptyDailySafetyChecklist('2026-09-30')),
    )
    const nov1 = parseDailySafetyChecklist(
      serializeChecklist(emptyDailySafetyChecklist('2026-11-01')),
    )
    const from = '2026-10-01'
    const to = '2026-10-31'
    expect(checkDateInRange(oct1, from, to)).toBe(true)
    expect(checkDateInRange(oct2, from, to)).toBe(true)
    expect(checkDateInRange(oct3, from, to)).toBe(true)
    expect(checkDateInRange(oct31, from, to)).toBe(true)
    expect(checkDateInRange(sep30, from, to)).toBe(false)
    expect(checkDateInRange(nov1, from, to)).toBe(false)
  })

  it('October period includes Oct 2 + multiple Oct 3 non-drafts for a site', () => {
    const items: PeriodSubmissionSource[] = [
      source({ id: 'oct2', checkDate: '2026-10-02', status: 'approved' }),
      source({ id: 'oct3a', checkDate: '2026-10-03', status: 'approved' }),
      source({ id: 'oct3b', checkDate: '2026-10-03', status: 'submitted' }),
      source({ id: 'oct3-draft', checkDate: '2026-10-03', status: 'draft' }),
      source({
        id: 'other-site',
        checkDate: '2026-10-03',
        status: 'submitted',
        siteId: 'site-b',
      }),
      source({ id: 'sep', checkDate: '2026-09-30', status: 'submitted' }),
    ]
    const rows = filterSubmissionsForPeriod(items, {
      siteId: 'site-a',
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    })
    expect(rows.map((r) => r.id).sort()).toEqual(['oct2', 'oct3a', 'oct3b'])
    expect(rows).toHaveLength(3)
  })

  it('includes month-boundary checkDates when bounds are inclusive', () => {
    const items = [
      source({ id: 'first', checkDate: '2026-10-01' }),
      source({ id: 'last', checkDate: '2026-10-31' }),
    ]
    const rows = filterSubmissionsForPeriod(items, {
      siteId: 'site-a',
      fromDate: monthBounds(2026, 10).fromDate,
      toDate: monthBounds(2026, 10).toDate,
    })
    expect(rows.map((r) => r.id).sort()).toEqual(['first', 'last'])
  })

  it('uses local created_at day when checkDate is missing (not UTC slice alone)', () => {
    const created = '2026-10-03T01:15:00.000Z'
    const localDay = localDateISO(new Date(created))
    const item: PeriodSubmissionSource = {
      id: 'no-check-date',
      site_id: 'site-a',
      status: 'submitted',
      checklist: {
        schemaVersion: 1,
        reportType: 'daily_safety_check',
        // missing checkDate → parser uses fallback
        ppe: {},
        fallProtection: {},
        toolsAndWorkArea: {},
        hazards: {},
        incidentOrNearMiss: {},
      },
      created_at: created,
      updated_at: created,
      sites: { name: 'Cobble Hill' },
      submitter: { display_name: 'Leland' },
    }
    const rows = filterSubmissionsForPeriod([item], {
      siteId: 'site-a',
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    })
    expect(rows).toHaveLength(1)
    const parsed = parseDailySafetyChecklist(
      rows[0].checklist,
      normalizeCalendarDate(created),
    )
    expect(parsed.checkDate).toBe(localDay)
  })
})
