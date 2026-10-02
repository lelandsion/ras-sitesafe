import { describe, expect, it, vi } from 'vitest'
import { humanizeDbError } from './sitesService'

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

describe('humanizeDbError', () => {
  it('explains missing schema / PGRST205', () => {
    expect(humanizeDbError('PGRST205 Could not find the table')).toMatch(
      /SQL migration/i,
    )
    expect(humanizeDbError('schema cache miss')).toMatch(/migration/i)
  })

  it('explains auth / JWT failures', () => {
    expect(humanizeDbError('JWT expired')).toMatch(/Sign in again/i)
    expect(humanizeDbError('not authenticated')).toMatch(/Sign in again/i)
  })

  it('passes through unknown messages', () => {
    expect(humanizeDbError('permission denied for table sites')).toBe(
      'permission denied for table sites',
    )
  })
})
