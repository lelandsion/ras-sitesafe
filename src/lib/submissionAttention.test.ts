import { describe, expect, it } from 'vitest'
import {
  nextStatusOnCorrectiveActionCreate,
  reviewPatchOnCorrectiveActionCreate,
  sortAdminSubmissions,
} from './submissionAttention'
import type { SubmissionStatus } from '../types/database'

describe('nextStatusOnCorrectiveActionCreate', () => {
  it('moves draft and submitted into under_review', () => {
    expect(nextStatusOnCorrectiveActionCreate('draft')).toBe('under_review')
    expect(nextStatusOnCorrectiveActionCreate('submitted')).toBe('under_review')
  })

  it('keeps under_review / approved / rejected unchanged', () => {
    expect(nextStatusOnCorrectiveActionCreate('under_review')).toBeNull()
    expect(nextStatusOnCorrectiveActionCreate('approved')).toBeNull()
    expect(nextStatusOnCorrectiveActionCreate('rejected')).toBeNull()
  })
})

describe('reviewPatchOnCorrectiveActionCreate', () => {
  it('returns status + reviewer stamp when transitioning', () => {
    expect(
      reviewPatchOnCorrectiveActionCreate(
        'submitted',
        'admin-1',
        '2026-10-03T12:00:00.000Z',
      ),
    ).toEqual({
      status: 'under_review',
      reviewed_by: 'admin-1',
      reviewed_at: '2026-10-03T12:00:00.000Z',
    })
  })

  it('returns null when status should not change', () => {
    expect(
      reviewPatchOnCorrectiveActionCreate('approved', 'admin-1'),
    ).toBeNull()
    expect(
      reviewPatchOnCorrectiveActionCreate('under_review', 'admin-1'),
    ).toBeNull()
  })
})

describe('sortAdminSubmissions', () => {
  function item(
    id: string,
    status: SubmissionStatus,
    updated_at: string,
  ) {
    return { id, status, updated_at, created_at: updated_at }
  }

  it('orders by attention status then newest-first within a bucket', () => {
    const sorted = sortAdminSubmissions([
      item('old-approved', 'approved', '2026-10-03T10:00:00.000Z'),
      item('new-submitted', 'submitted', '2026-10-03T18:00:00.000Z'),
      item('old-review', 'under_review', '2026-10-03T08:00:00.000Z'),
      item('rejected', 'rejected', '2026-10-03T20:00:00.000Z'),
      item('old-submitted', 'submitted', '2026-10-03T09:00:00.000Z'),
      item('new-review', 'under_review', '2026-10-03T19:00:00.000Z'),
      item('draft', 'draft', '2026-10-03T17:00:00.000Z'),
    ])

    expect(sorted.map((s) => s.id)).toEqual([
      'new-review',
      'old-review',
      'new-submitted',
      'old-submitted',
      'draft',
      'old-approved',
      'rejected',
    ])
  })

  it('does not mutate the input array', () => {
    const input = [
      item('a', 'approved', '2026-10-03T10:00:00.000Z'),
      item('b', 'under_review', '2026-10-03T11:00:00.000Z'),
    ]
    const copy = [...input]
    sortAdminSubmissions(input)
    expect(input).toEqual(copy)
  })
})
