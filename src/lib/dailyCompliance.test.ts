import { describe, expect, it } from 'vitest'
import { emptyDailySafetyChecklist } from '../types/safetyChecklist'
import {
  buildComplianceRows,
  filterComplianceRows,
  isAssignedOnDate,
  summarizeCompliance,
  submissionsForSiteDate,
} from './dailyCompliance'

describe('isAssignedOnDate', () => {
  it('includes active assignments assigned on or before the day', () => {
    expect(
      isAssignedOnDate(
        { assigned_at: '2026-10-01T12:00:00Z', unassigned_at: null },
        '2026-10-02',
      ),
    ).toBe(true)
    expect(
      isAssignedOnDate(
        { assigned_at: '2026-10-03T12:00:00Z', unassigned_at: null },
        '2026-10-02',
      ),
    ).toBe(false)
  })

  it('excludes workers unassigned on or before the day', () => {
    expect(
      isAssignedOnDate(
        {
          assigned_at: '2026-09-01T12:00:00Z',
          unassigned_at: '2026-10-02T09:00:00Z',
        },
        '2026-10-02',
      ),
    ).toBe(false)
    expect(
      isAssignedOnDate(
        {
          assigned_at: '2026-09-01T12:00:00Z',
          unassigned_at: '2026-10-03T09:00:00Z',
        },
        '2026-10-02',
      ),
    ).toBe(true)
  })
})

describe('buildComplianceRows', () => {
  it('marks Missing only for assigned workers without a submission', () => {
    const checklist = emptyDailySafetyChecklist('2026-10-02')
    checklist.ppe.hardHat = 'no'

    const rows = buildComplianceRows({
      siteId: 'site-1',
      dateISO: '2026-10-02',
      assignments: [
        {
          framer_id: 'f1',
          assigned_at: '2026-10-01T00:00:00Z',
          unassigned_at: null,
          framer: { id: 'f1', display_name: 'Daniel Ortiz' },
        },
        {
          framer_id: 'f2',
          assigned_at: '2026-10-01T00:00:00Z',
          unassigned_at: null,
          framer: { id: 'f2', display_name: 'Alex Kim' },
        },
        {
          framer_id: 'f3',
          assigned_at: '2026-09-01T00:00:00Z',
          unassigned_at: '2026-10-01T00:00:00Z',
          framer: { id: 'f3', display_name: 'Not Assigned Today' },
        },
      ],
      submissions: [
        {
          id: 'sub-1',
          site_id: 'site-1',
          submitted_by: 'f1',
          status: 'submitted',
          checklist,
          created_at: '2026-10-02T14:00:00Z',
          updated_at: '2026-10-02T14:00:00Z',
        },
      ],
    })

    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.framerId === 'f1')?.status).toBe('safety_issue')
    expect(rows.find((r) => r.framerId === 'f2')?.status).toBe('not_submitted')
    expect(rows.find((r) => r.framerId === 'f3')).toBeUndefined()

    const summary = summarizeCompliance(rows)
    expect(summary).toEqual({
      assigned: 2,
      submitted: 1,
      missing: 1,
      issues: 1,
    })

    expect(filterComplianceRows(rows, 'missing')).toHaveLength(1)
    expect(filterComplianceRows(rows, 'issues')).toHaveLength(1)
  })

  it('ignores draft submissions for the date', () => {
    const map = submissionsForSiteDate('site-1', '2026-10-02', [
      {
        id: 'd1',
        site_id: 'site-1',
        submitted_by: 'f1',
        status: 'draft',
        checklist: emptyDailySafetyChecklist('2026-10-02'),
        created_at: '2026-10-02T10:00:00Z',
        updated_at: '2026-10-02T10:00:00Z',
      },
    ])
    expect(map.size).toBe(0)
  })
})
