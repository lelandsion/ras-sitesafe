import { describe, expect, it } from 'vitest'
import { buildStatusCounts } from './SubmissionsStatusChart'

describe('buildStatusCounts', () => {
  it('returns zeroed rows for every status when empty', () => {
    expect(buildStatusCounts([])).toEqual([
      { status: 'draft', label: 'Draft', count: 0 },
      { status: 'submitted', label: 'Submitted', count: 0 },
      { status: 'under_review', label: 'Under review', count: 0 },
      { status: 'approved', label: 'Approved', count: 0 },
      { status: 'rejected', label: 'Rejected', count: 0 },
    ])
  })

  it('aggregates statuses in display order', () => {
    const counts = buildStatusCounts([
      'approved',
      'draft',
      'approved',
      'submitted',
      'under_review',
      'rejected',
      'submitted',
    ])
    expect(counts.map((c) => c.count)).toEqual([1, 2, 1, 2, 1])
    expect(counts.map((c) => c.status)).toEqual([
      'draft',
      'submitted',
      'under_review',
      'approved',
      'rejected',
    ])
  })
})
