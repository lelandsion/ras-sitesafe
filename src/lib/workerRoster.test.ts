import { describe, expect, it } from 'vitest'
import { emptyDailySafetyChecklist } from '../types/safetyChecklist'
import { buildWorkerRosterRows } from './workerRoster'

describe('buildWorkerRosterRows', () => {
  const siteNamesById = new Map([
    ['site-a', 'Harbor Deck'],
    ['site-b', 'Pier 9'],
  ])

  it('marks Unassigned workers as N/A', () => {
    const rows = buildWorkerRosterRows({
      framers: [{ id: 'f1', display_name: 'Alex Kim' }],
      assignments: [],
      siteNamesById,
      submissions: [],
      dateISO: '2026-10-03',
    })
    expect(rows).toEqual([
      {
        framerId: 'f1',
        displayName: 'Alex Kim',
        siteNames: [],
        todayStatus: 'n_a',
      },
    ])
  })

  it('uses isAssignedOnDate so soft-unassign drops sites and status becomes N/A', () => {
    const unassignLocal = new Date(2026, 9, 3, 22, 0, 0)
    const rows = buildWorkerRosterRows({
      framers: [{ id: 'f1', display_name: 'Removed Today' }],
      assignments: [
        {
          framer_id: 'f1',
          site_id: 'site-a',
          assigned_at: '2026-09-01T00:00:00.000Z',
          unassigned_at: unassignLocal.toISOString(),
        },
      ],
      siteNamesById,
      submissions: [],
      dateISO: '2026-10-03',
    })
    expect(rows[0].siteNames).toEqual([])
    expect(rows[0].todayStatus).toBe('n_a')
  })

  it('marks Missing when assigned with no submission for the date', () => {
    const rows = buildWorkerRosterRows({
      framers: [{ id: 'f1', display_name: 'Daniel Ortiz' }],
      assignments: [
        {
          framer_id: 'f1',
          site_id: 'site-a',
          assigned_at: '2026-09-01T00:00:00Z',
          unassigned_at: null,
        },
      ],
      siteNamesById,
      submissions: [],
      dateISO: '2026-10-03',
    })
    expect(rows[0].siteNames).toEqual(['Harbor Deck'])
    expect(rows[0].todayStatus).toBe('missing')
  })

  it('marks Submitted only when every active site has a non-draft check', () => {
    const checklist = emptyDailySafetyChecklist('2026-10-03')
    const rows = buildWorkerRosterRows({
      framers: [{ id: 'f1', display_name: 'Daniel Ortiz' }],
      assignments: [
        {
          framer_id: 'f1',
          site_id: 'site-a',
          assigned_at: '2026-09-01T00:00:00Z',
          unassigned_at: null,
        },
        {
          framer_id: 'f1',
          site_id: 'site-b',
          assigned_at: '2026-09-01T00:00:00Z',
          unassigned_at: null,
        },
      ],
      siteNamesById,
      submissions: [
        {
          id: 's1',
          site_id: 'site-a',
          submitted_by: 'f1',
          status: 'submitted',
          checklist,
          created_at: '2026-10-03T12:00:00Z',
          updated_at: '2026-10-03T12:00:00Z',
        },
      ],
      dateISO: '2026-10-03',
    })
    expect(rows[0].siteNames).toEqual(['Harbor Deck', 'Pier 9'])
    expect(rows[0].todayStatus).toBe('missing')

    const complete = buildWorkerRosterRows({
      framers: [{ id: 'f1', display_name: 'Daniel Ortiz' }],
      assignments: [
        {
          framer_id: 'f1',
          site_id: 'site-a',
          assigned_at: '2026-09-01T00:00:00Z',
          unassigned_at: null,
        },
        {
          framer_id: 'f1',
          site_id: 'site-b',
          assigned_at: '2026-09-01T00:00:00Z',
          unassigned_at: null,
        },
      ],
      siteNamesById,
      submissions: [
        {
          id: 's1',
          site_id: 'site-a',
          submitted_by: 'f1',
          status: 'submitted',
          checklist,
          created_at: '2026-10-03T12:00:00Z',
          updated_at: '2026-10-03T12:00:00Z',
        },
        {
          id: 's2',
          site_id: 'site-b',
          submitted_by: 'f1',
          status: 'approved',
          checklist,
          created_at: '2026-10-03T13:00:00Z',
          updated_at: '2026-10-03T13:00:00Z',
        },
      ],
      dateISO: '2026-10-03',
    })
    expect(complete[0].todayStatus).toBe('submitted')
  })

  it('sorts by display name', () => {
    const rows = buildWorkerRosterRows({
      framers: [
        { id: 'f2', display_name: 'Zoe' },
        { id: 'f1', display_name: 'Alex' },
      ],
      assignments: [],
      siteNamesById,
      submissions: [],
      dateISO: '2026-10-03',
    })
    expect(rows.map((r) => r.displayName)).toEqual(['Alex', 'Zoe'])
  })
})
