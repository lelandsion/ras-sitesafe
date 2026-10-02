import { describe, expect, it, vi } from 'vitest'
import { filterFramerDirectory, humanizeDbError } from './sitesService'
import type { FramerDirectoryEntry } from '../types/database'

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

describe('filterFramerDirectory', () => {
  const rows: FramerDirectoryEntry[] = [
    {
      id: 'a',
      display_name: 'Daniel Ortiz',
      email: 'framer@ras-sitesafe-demo.com',
    },
    {
      id: 'b',
      display_name: 'Alex Kim',
      email: 'alex@example.com',
    },
  ]

  it('filters by display name or email', () => {
    expect(filterFramerDirectory(rows, 'daniel', new Set())).toHaveLength(1)
    expect(filterFramerDirectory(rows, 'demo.com', new Set())).toHaveLength(1)
  })

  it('excludes already assigned framers', () => {
    expect(filterFramerDirectory(rows, '', new Set(['a']))).toEqual([rows[1]])
  })
})
