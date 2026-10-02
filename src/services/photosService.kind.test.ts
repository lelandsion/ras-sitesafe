import { describe, expect, it, vi } from 'vitest'
import {
  isMissingPhotoKindColumn,
  withDefaultPhotoKind,
} from './photosService'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

describe('photo_kind helpers', () => {
  it('detects missing photo_kind / column errors', () => {
    expect(isMissingPhotoKindColumn('column photo_kind does not exist')).toBe(
      true,
    )
    expect(isMissingPhotoKindColumn('Could not find the photo_kind column')).toBe(
      true,
    )
    expect(isMissingPhotoKindColumn('schema cache miss')).toBe(true)
    expect(isMissingPhotoKindColumn('permission denied')).toBe(false)
  })

  it('defaults missing photo_kind to site', () => {
    const rows = withDefaultPhotoKind([
      {
        id: '1',
        submission_id: 's1',
        storage_path: 'a/b.jpg',
        content_type: 'image/jpeg',
        byte_size: 100,
        created_at: '2026-10-02T00:00:00Z',
      },
      {
        id: '2',
        submission_id: 's1',
        storage_path: 'a/c.jpg',
        content_type: 'image/png',
        byte_size: 200,
        photo_kind: 'hazard',
        created_at: '2026-10-02T00:00:00Z',
      },
    ])
    expect(rows[0]?.photo_kind).toBe('site')
    expect(rows[1]?.photo_kind).toBe('hazard')
  })
})
