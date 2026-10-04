import { describe, expect, it } from 'vitest'
import {
  caAttentionBadgeLabel,
  pickActiveCaAttention,
  sortSafetyIssuesByCaStatus,
} from './caAttention'
import type {
  CorrectiveActionStatus,
  SafetyIssueWithDetails,
} from '../types/correctiveActions'

function issue(
  id: string,
  status: CorrectiveActionStatus | null,
  created_at: string,
): SafetyIssueWithDetails {
  return {
    id,
    submission_id: 'sub-1',
    checklist_item_key: 'ppe.hardHat',
    item_label: id,
    description: 'desc',
    severity: 'medium',
    immediate_action: '',
    created_by: null,
    created_at,
    updated_at: created_at,
    submission: null,
    corrective_action: status
      ? {
          id: `ca-${id}`,
          safety_issue_id: id,
          required_action: 'Fix',
          priority: 'medium',
          status,
          assignee_id: null,
          due_date: null,
          resolution_notes: null,
          resolved_by: null,
          resolved_at: null,
          framer_completed_at: null,
          framer_completion_notes: null,
          created_by: null,
          created_at,
          updated_at: created_at,
        }
      : null,
  }
}

describe('pickActiveCaAttention', () => {
  it('prefers ready_for_review over open/in_progress', () => {
    expect(
      pickActiveCaAttention(['open', 'ready_for_review', 'in_progress']),
    ).toBe('ready_for_review')
  })

  it('prefers in_progress over open', () => {
    expect(pickActiveCaAttention(['open', 'in_progress', 'resolved'])).toBe(
      'in_progress',
    )
  })

  it('returns open when that is the only active status', () => {
    expect(pickActiveCaAttention(['resolved', 'open'])).toBe('open')
  })

  it('returns null when only resolved or empty', () => {
    expect(pickActiveCaAttention(['resolved'])).toBeNull()
    expect(pickActiveCaAttention([])).toBeNull()
  })
})

describe('caAttentionBadgeLabel', () => {
  it('labels ready vs active CA', () => {
    expect(caAttentionBadgeLabel('ready_for_review')).toBe(
      'CA ready for review',
    )
    expect(caAttentionBadgeLabel('open')).toBe('Corrective action')
    expect(caAttentionBadgeLabel('in_progress')).toBe('Corrective action')
    expect(caAttentionBadgeLabel(null)).toBeNull()
  })
})

describe('sortSafetyIssuesByCaStatus', () => {
  it('orders open → in_progress → ready_for_review → no CA → resolved last, newest within bucket', () => {
    const sorted = sortSafetyIssuesByCaStatus([
      issue('resolved-new', 'resolved', '2026-10-03T20:00:00.000Z'),
      issue('ready-old', 'ready_for_review', '2026-10-01T12:00:00.000Z'),
      issue('open-new', 'open', '2026-10-03T18:00:00.000Z'),
      issue('no-ca', null, '2026-10-03T22:00:00.000Z'),
      issue('in-prog', 'in_progress', '2026-10-02T12:00:00.000Z'),
      issue('open-old', 'open', '2026-10-01T08:00:00.000Z'),
      issue('ready-new', 'ready_for_review', '2026-10-03T19:00:00.000Z'),
    ])

    expect(sorted.map((i) => i.id)).toEqual([
      'open-new',
      'open-old',
      'in-prog',
      'ready-new',
      'ready-old',
      'no-ca',
      'resolved-new',
    ])
  })

  it('does not mutate the input', () => {
    const input = [
      issue('a', 'resolved', '2026-10-01T00:00:00.000Z'),
      issue('b', 'open', '2026-10-02T00:00:00.000Z'),
    ]
    const copy = [...input]
    sortSafetyIssuesByCaStatus(input)
    expect(input).toEqual(copy)
  })
})
