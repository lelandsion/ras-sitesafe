import { describe, expect, it } from 'vitest'
import {
  countActiveFilters,
  EMPTY_SUBMISSION_FILTERS,
  excludeDraftSubmissions,
  filterSubmissions,
  uniqueSitesFromSubmissions,
  uniqueWorkersFromSubmissions,
} from './filterSubmissions'
import type { SubmissionWithDetails } from '../types/database'
import { emptyDailySafetyChecklist } from '../types/safetyChecklist'

function row(
  overrides: Partial<SubmissionWithDetails> & {
    id: string
    site_id: string
    submitted_by: string
    checkDate?: string
    hazard?: boolean
  },
): SubmissionWithDetails {
  const checklist = emptyDailySafetyChecklist(
    overrides.checkDate ?? '2026-10-01',
  )
  if (overrides.hazard) {
    checklist.hazards.present = true
    checklist.hazards.description = 'Loose lumber'
    checklist.hazards.severity = 'moderate'
  }
  return {
    id: overrides.id,
    site_id: overrides.site_id,
    submitted_by: overrides.submitted_by,
    status: overrides.status ?? 'submitted',
    notes: overrides.notes ?? null,
    checklist: checklist as unknown as Record<string, unknown>,
    reviewed_by: null,
    reviewed_at: null,
    created_at: `${overrides.checkDate ?? '2026-10-01'}T12:00:00.000Z`,
    updated_at: `${overrides.checkDate ?? '2026-10-01'}T12:00:00.000Z`,
    sites: overrides.sites ?? {
      id: overrides.site_id,
      name: `Site ${overrides.site_id}`,
      address: null,
    },
    submitter: overrides.submitter ?? {
      id: overrides.submitted_by,
      display_name: `Worker ${overrides.submitted_by}`,
    },
  }
}

const items: SubmissionWithDetails[] = [
  row({
    id: '1',
    site_id: 's1',
    submitted_by: 'w1',
    checkDate: '2026-10-01',
    status: 'submitted',
  }),
  row({
    id: '2',
    site_id: 's2',
    submitted_by: 'w2',
    checkDate: '2026-10-02',
    status: 'approved',
    hazard: true,
  }),
  row({
    id: '3',
    site_id: 's1',
    submitted_by: 'w2',
    checkDate: '2026-10-03',
    status: 'draft',
  }),
]

describe('filterSubmissions', () => {
  it('hides drafts from admin filters even when status is all', () => {
    expect(
      filterSubmissions(items, EMPTY_SUBMISSION_FILTERS).map((i) => i.id),
    ).toEqual(['1', '2'])
  })

  it('filters by site, worker, and status', () => {
    expect(
      filterSubmissions(items, {
        ...EMPTY_SUBMISSION_FILTERS,
        siteId: 's1',
      }).map((i) => i.id),
    ).toEqual(['1'])

    expect(
      filterSubmissions(items, {
        ...EMPTY_SUBMISSION_FILTERS,
        workerId: 'w2',
        status: 'approved',
      }).map((i) => i.id),
    ).toEqual(['2'])
  })

  it('filters by date range and issues', () => {
    expect(
      filterSubmissions(items, {
        ...EMPTY_SUBMISSION_FILTERS,
        dateFrom: '2026-10-02',
        dateTo: '2026-10-02',
      }).map((i) => i.id),
    ).toEqual(['2'])

    expect(
      filterSubmissions(items, {
        ...EMPTY_SUBMISSION_FILTERS,
        issues: 'has_issues',
      }).map((i) => i.id),
    ).toEqual(['2'])

    expect(
      filterSubmissions(items, {
        ...EMPTY_SUBMISSION_FILTERS,
        issues: 'no_issues',
      }).map((i) => i.id),
    ).toEqual(['1'])
  })

  it('builds unique site and worker options', () => {
    expect(uniqueSitesFromSubmissions(items).map((s) => s.id)).toEqual([
      's1',
      's2',
    ])
    expect(uniqueWorkersFromSubmissions(items).map((w) => w.id).sort()).toEqual(
      ['w1', 'w2'],
    )
  })

  it('counts active filters', () => {
    expect(countActiveFilters(EMPTY_SUBMISSION_FILTERS)).toBe(0)
    expect(
      countActiveFilters({
        siteId: 's1',
        workerId: '',
        dateFrom: '2026-10-01',
        dateTo: '',
        issues: 'has_issues',
        status: 'submitted',
      }),
    ).toBe(4)
  })

  it('excludeDraftSubmissions keeps only non-draft rows', () => {
    expect(excludeDraftSubmissions(items).map((i) => i.id)).toEqual(['1', '2'])
  })
})
