import { describe, expect, it } from 'vitest'
import {
  ADMIN_REVIEW_STATUSES,
  PHOTO_ALLOWED_TYPES,
  PHOTO_BUCKET,
  PHOTO_MAX_BYTES,
  SUBMISSION_PHOTO_KIND_LABELS,
  SUBMISSION_STATUS_LABELS,
} from './database'

describe('submission status helpers', () => {
  it('labels every status for UI badges', () => {
    expect(SUBMISSION_STATUS_LABELS).toEqual({
      draft: 'Draft',
      submitted: 'Submitted',
      under_review: 'Under review',
      approved: 'Approved',
      rejected: 'Rejected',
    })
  })

  it('limits admin review actions to non-draft statuses', () => {
    expect([...ADMIN_REVIEW_STATUSES]).toEqual([
      'under_review',
      'approved',
      'rejected',
    ])
    expect(ADMIN_REVIEW_STATUSES).not.toContain('draft')
    expect(ADMIN_REVIEW_STATUSES).not.toContain('submitted')
  })
})

describe('photo constraint constants', () => {
  it('mirrors Storage allow-list and 8 MiB cap', () => {
    expect([...PHOTO_ALLOWED_TYPES]).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ])
    expect(PHOTO_MAX_BYTES).toBe(8 * 1024 * 1024)
    expect(PHOTO_BUCKET).toBe('submission-photos')
  })

  it('labels photo kinds for UI and PDF sections', () => {
    expect(SUBMISSION_PHOTO_KIND_LABELS).toEqual({
      site: 'Site photos',
      hazard: 'Hazard photos',
      issue: 'Issue photos',
      resolution: 'Resolution photos',
      corrective_action: 'Corrective action photos',
    })
  })
})
