import { supabase } from '../lib/supabase'
import { listAdminSites, listAssignedSites } from './sitesService'
import { humanizeDbError } from './sitesService'
import type { Site, UserRole } from '../types/database'

export type AccountSiteRow = Pick<Site, 'id' | 'name' | 'address'>

export type SafetyActivityStats = {
  checksSubmitted: number
  thisMonth: number
  lastSubmissionAt: string | null
}

export type AccountSummary = {
  sites: AccountSiteRow[]
  sitesHeading: string
  activity: SafetyActivityStats
}

function isThisMonth(iso: string, now: Date): boolean {
  const t = new Date(iso)
  return (
    t.getUTCFullYear() === now.getUTCFullYear() &&
    t.getUTCMonth() === now.getUTCMonth()
  )
}

function countSubmittedStatuses(status: string): boolean {
  return status !== 'draft'
}

export async function loadAccountSummary(role: UserRole): Promise<{
  data: AccountSummary | null
  error: string | null
}> {
  const now = new Date()

  if (role === 'framer') {
    const [sitesResult, subsResult] = await Promise.all([
      listAssignedSites(),
      supabase
        .from('submissions')
        .select('id, status, updated_at, created_at')
        .order('updated_at', { ascending: false }),
    ])

    if (sitesResult.error) {
      return { data: null, error: sitesResult.error }
    }
    if (subsResult.error) {
      return { data: null, error: humanizeDbError(subsResult.error.message) }
    }

    const rows = subsResult.data ?? []
    const submitted = rows.filter((r) => countSubmittedStatuses(r.status as string))
    const thisMonth = submitted.filter((r) => isThisMonth(r.updated_at, now))

    return {
      data: {
        sites: sitesResult.data.map((s) => ({
          id: s.id,
          name: s.name,
          address: s.address,
        })),
        sitesHeading: 'Current Sites',
        activity: {
          checksSubmitted: submitted.length,
          thisMonth: thisMonth.length,
          lastSubmissionAt: submitted[0]?.updated_at ?? null,
        },
      },
      error: null,
    }
  }

  const [sitesResult, subsResult] = await Promise.all([
    listAdminSites(),
    supabase
      .from('submissions')
      .select('id, status, updated_at')
      .order('updated_at', { ascending: false }),
  ])

  if (sitesResult.error) {
    return { data: null, error: sitesResult.error }
  }
  if (subsResult.error) {
    return { data: null, error: humanizeDbError(subsResult.error.message) }
  }

  const activeSites = sitesResult.data.filter((s) => s.is_active)
  const rows = subsResult.data ?? []
  const submitted = rows.filter((r) => countSubmittedStatuses(r.status as string))
  const thisMonth = submitted.filter((r) => isThisMonth(r.updated_at, now))

  return {
    data: {
      sites: activeSites.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
      })),
      sitesHeading: `Active sites (${activeSites.length})`,
      activity: {
        checksSubmitted: submitted.length,
        thisMonth: thisMonth.length,
        lastSubmissionAt: submitted[0]?.updated_at ?? null,
      },
    },
    error: null,
  }
}
