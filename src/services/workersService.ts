import { supabase } from '../lib/supabase'
import { localDateISO } from '../lib/dailyCompliance'
import {
  buildWorkerRosterRows,
  type WorkerRosterRow,
} from '../lib/workerRoster'
import type { ComplianceSubmissionSnippet } from '../lib/dailyCompliance'
import { humanizeDbError, listFramersForAdmin } from './sitesService'

type AssignmentJoinRow = {
  id: string
  site_id: string
  framer_id: string
  assigned_at: string
  unassigned_at: string | null
  sites: { id: string; name: string } | { id: string; name: string }[] | null
}

async function listAssignmentHistoryForRoster(): Promise<{
  data: AssignmentJoinRow[]
  error: string | null
}> {
  const withHistory = await supabase
    .from('site_assignments')
    .select(
      'id, site_id, framer_id, assigned_at, unassigned_at, sites:sites!site_assignments_site_id_fkey ( id, name )',
    )
    .order('assigned_at', { ascending: true })

  let data = withHistory.data as AssignmentJoinRow[] | null
  let error = withHistory.error

  if (
    error &&
    (error.message.includes('unassigned_at') ||
      error.message.includes('schema cache'))
  ) {
    const legacy = await supabase
      .from('site_assignments')
      .select(
        'id, site_id, framer_id, assigned_at, sites:sites!site_assignments_site_id_fkey ( id, name )',
      )
      .order('assigned_at', { ascending: true })
    data = (legacy.data ?? []).map((row) => ({
      ...row,
      unassigned_at: null,
    })) as AssignmentJoinRow[]
    error = legacy.error
  }

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  return { data: data ?? [], error: null }
}

async function listNonDraftSubmissions(): Promise<{
  data: ComplianceSubmissionSnippet[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id, site_id, submitted_by, status, checklist, created_at, updated_at',
    )
    .neq('status', 'draft')

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  return {
    data: (data ?? []) as ComplianceSubmissionSnippet[],
    error: null,
  }
}

function siteFromJoin(
  sites: AssignmentJoinRow['sites'],
): { id: string; name: string } | null {
  if (!sites) return null
  return Array.isArray(sites) ? (sites[0] ?? null) : sites
}

/** Admin Workers tab: framers + today's active sites + submission status. */
export async function loadWorkerRoster(dateISO = localDateISO()): Promise<{
  rows: WorkerRosterRow[]
  dateISO: string
  error: string | null
}> {
  const [framersResult, assignResult, subResult] = await Promise.all([
    listFramersForAdmin(),
    listAssignmentHistoryForRoster(),
    listNonDraftSubmissions(),
  ])

  if (framersResult.error) {
    return { rows: [], dateISO, error: framersResult.error }
  }
  if (assignResult.error) {
    return { rows: [], dateISO, error: assignResult.error }
  }
  if (subResult.error) {
    return { rows: [], dateISO, error: subResult.error }
  }

  const siteNamesById = new Map<string, string>()
  const assignments = assignResult.data.map((row) => {
    const site = siteFromJoin(row.sites)
    if (site) siteNamesById.set(site.id, site.name)
    return {
      framer_id: row.framer_id,
      site_id: row.site_id,
      assigned_at: row.assigned_at,
      unassigned_at: row.unassigned_at,
    }
  })

  const rows = buildWorkerRosterRows({
    framers: framersResult.data.map((f) => ({
      id: f.id,
      display_name: f.display_name,
    })),
    assignments,
    siteNamesById,
    submissions: subResult.data,
    dateISO,
  })

  return { rows, dateISO, error: null }
}
