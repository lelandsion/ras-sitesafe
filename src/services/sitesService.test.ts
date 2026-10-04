import { describe, expect, it, vi } from 'vitest'
import {
  canGenerateSiteReport,
  filterFramerDirectory,
  humanizeDbError,
} from './sitesService'
import type { FramerDirectoryEntry } from '../types/database'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'assigned-1', name: 'Assigned', is_active: true }],
        error: null,
      }),
    })),
  },
}))

describe('humanizeDbError', () => {
  it('explains missing schema / PGRST205 without developer setup steps', () => {
    expect(humanizeDbError('PGRST205 Could not find the table')).toMatch(
      /temporarily unavailable/i,
    )
    expect(humanizeDbError('schema cache miss')).toMatch(/unavailable|admin/i)
    expect(humanizeDbError('PGRST205')).not.toMatch(/SQL|migration|\.sql/i)
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

describe('canGenerateSiteReport', () => {
  it('allows admins for any site id', async () => {
    await expect(
      canGenerateSiteReport({ siteId: 'any-site', role: 'admin' }),
    ).resolves.toEqual({ ok: true })
  })

  it('rejects missing site id', async () => {
    await expect(
      canGenerateSiteReport({ siteId: '', role: 'framer' }),
    ).resolves.toMatchObject({ ok: false })
  })

  it('rejects framers for sites they are not assigned to', async () => {
    await expect(
      canGenerateSiteReport({ siteId: 'other-site', role: 'framer' }),
    ).resolves.toMatchObject({ ok: false })
  })

  it('allows framers for an assigned site', async () => {
    await expect(
      canGenerateSiteReport({ siteId: 'assigned-1', role: 'framer' }),
    ).resolves.toEqual({ ok: true })
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
