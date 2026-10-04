import { supabase } from '../lib/supabase'
import type {
  FramerDirectoryEntry,
  Site,
  SiteAssignmentWithFramer,
  SiteWithAssignmentCount,
  UserRole,
} from '../types/database'

export type SiteUpsertInput = {
  name: string
  address: string | null
  is_active: boolean
}

type SiteRowWithCount = Site & {
  site_assignments:
    | { count: number }[]
    | { id: string; unassigned_at?: string | null }[]
    | null
}

function mapSiteWithCount(row: SiteRowWithCount): SiteWithAssignmentCount {
  const assignments = row.site_assignments ?? []
  let count = 0
  if (assignments.length > 0 && 'count' in assignments[0]) {
    count = (assignments[0] as { count: number }).count ?? 0
  } else {
    count = (
      assignments as { id: string; unassigned_at?: string | null }[]
    ).filter((a) => !a.unassigned_at).length
  }
  const { site_assignments: _ignored, ...site } = row
  return { ...site, assignment_count: count }
}

/**
 * Active sites visible to the signed-in user.
 * RLS (`sites_select_admin_or_assigned`): admins see all active sites
 * (no `site_assignments` required); framers see only assigned sites.
 */
export async function listAssignedSites(): Promise<{
  data: Site[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, address, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  return { data: (data ?? []) as Site[], error: null }
}

/**
 * Site-period reports: admins may use any site; framers (and other non-admins)
 * only sites returned by assignment-scoped RLS (`listAssignedSites`).
 */
export async function canGenerateSiteReport(params: {
  siteId: string
  role: UserRole | null | undefined
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!params.siteId) {
    return { ok: false, error: 'Select a jobsite for the report.' }
  }
  if (params.role === 'admin') {
    return { ok: true }
  }
  const { data, error } = await listAssignedSites()
  if (error) {
    return { ok: false, error }
  }
  if (!data.some((s) => s.id === params.siteId)) {
    return {
      ok: false,
      error: 'You are not assigned to that jobsite, so you cannot generate its report.',
    }
  }
  return { ok: true }
}

/**
 * All sites for admin UI (includes inactive) with assignment counts.
 * Prefer {@link listAssignedSites} for form pickers — same RLS, simpler select.
 */
export async function listAdminSites(): Promise<{
  data: SiteWithAssignmentCount[]
  error: string | null
}> {
  const withHistory = await supabase
    .from('sites')
    .select(
      'id, name, address, is_active, created_at, updated_at, site_assignments(id, unassigned_at)',
    )
    .order('name', { ascending: true })

  if (
    withHistory.error &&
    (withHistory.error.message.includes('unassigned_at') ||
      withHistory.error.message.includes('schema cache'))
  ) {
    const legacy = await supabase
      .from('sites')
      .select(
        'id, name, address, is_active, created_at, updated_at, site_assignments(count)',
      )
      .order('name', { ascending: true })
    if (legacy.error) {
      return { data: [], error: humanizeDbError(legacy.error.message) }
    }
    return {
      data: ((legacy.data ?? []) as SiteRowWithCount[]).map(mapSiteWithCount),
      error: null,
    }
  }

  if (withHistory.error) {
    return { data: [], error: humanizeDbError(withHistory.error.message) }
  }

  return {
    data: ((withHistory.data ?? []) as SiteRowWithCount[]).map(mapSiteWithCount),
    error: null,
  }
}

export async function createSite(
  input: SiteUpsertInput,
): Promise<{ data: Site | null; error: string | null }> {
  const name = input.name.trim()
  if (!name) {
    return { data: null, error: 'Site name is required.' }
  }

  const { data, error } = await supabase
    .from('sites')
    .insert({
      name,
      address: input.address?.trim() || null,
      is_active: input.is_active,
    })
    .select('id, name, address, is_active, created_at, updated_at')
    .single()

  if (error) {
    return { data: null, error: humanizeDbError(error.message) }
  }

  return { data: data as Site, error: null }
}

export async function updateSite(
  siteId: string,
  input: SiteUpsertInput,
): Promise<{ data: Site | null; error: string | null }> {
  const name = input.name.trim()
  if (!name) {
    return { data: null, error: 'Site name is required.' }
  }

  const { data, error } = await supabase
    .from('sites')
    .update({
      name,
      address: input.address?.trim() || null,
      is_active: input.is_active,
    })
    .eq('id', siteId)
    .select('id, name, address, is_active, created_at, updated_at')
    .single()

  if (error) {
    return { data: null, error: humanizeDbError(error.message) }
  }

  return { data: data as Site, error: null }
}

export async function listSiteAssignments(
  siteId: string,
): Promise<{ data: SiteAssignmentWithFramer[]; error: string | null }> {
  const withHistory = await supabase
    .from('site_assignments')
    .select(
      'id, site_id, framer_id, assigned_at, unassigned_at, framer:profiles!site_assignments_framer_id_fkey ( id, display_name )',
    )
    .eq('site_id', siteId)
    .is('unassigned_at', null)
    .order('assigned_at', { ascending: true })

  let data = withHistory.data
  let error = withHistory.error

  // Part 8 not applied — legacy active rows (hard delete model).
  if (
    error &&
    (error.message.includes('unassigned_at') ||
      error.message.includes('schema cache'))
  ) {
    const legacy = await supabase
      .from('site_assignments')
      .select(
        'id, site_id, framer_id, assigned_at, framer:profiles!site_assignments_framer_id_fkey ( id, display_name )',
      )
      .eq('site_id', siteId)
      .order('assigned_at', { ascending: true })
    data = (legacy.data ?? []).map((row) => ({
      ...row,
      unassigned_at: null,
    })) as typeof data
    error = legacy.error
  }

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  const rows = (data ?? []).map((row) => {
    const framer = row.framer
    const normalized =
      framer && Array.isArray(framer)
        ? (framer[0] ?? null)
        : (framer as SiteAssignmentWithFramer['framer'])
    return {
      ...row,
      unassigned_at: row.unassigned_at ?? null,
      framer: normalized,
    }
  })

  return { data: rows as SiteAssignmentWithFramer[], error: null }
}

export async function assignFramerToSite(
  siteId: string,
  framerId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('site_assignments').insert({
    site_id: siteId,
    framer_id: framerId,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'This framer is already assigned to the site.' }
    }
    return { error: humanizeDbError(error.message) }
  }

  return { error: null }
}

export async function removeSiteAssignment(
  assignmentId: string,
): Promise<{ error: string | null }> {
  // Soft-unassign when Part 8 is present; hard-delete as fallback.
  const soft = await supabase
    .from('site_assignments')
    .update({ unassigned_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .is('unassigned_at', null)

  if (!soft.error) {
    return { error: null }
  }

  if (
    soft.error.message.includes('unassigned_at') ||
    soft.error.message.includes('schema cache')
  ) {
    const { error } = await supabase
      .from('site_assignments')
      .delete()
      .eq('id', assignmentId)
    if (error) {
      return { error: humanizeDbError(error.message) }
    }
    return { error: null }
  }

  return { error: humanizeDbError(soft.error.message) }
}

/** Requires migration admin_list_framers (admin-only RPC). */
export async function listFramersForAdmin(): Promise<{
  data: FramerDirectoryEntry[]
  error: string | null
}> {
  const { data, error } = await supabase.rpc('admin_list_framers')

  if (error) {
    if (
      error.message.includes('Could not find the function') ||
      error.message.includes('admin_list_framers')
    ) {
      return {
        data: [],
        error:
          'Worker search is temporarily unavailable. Try again later or contact your SiteSafe admin.',
      }
    }
    return { data: [], error: humanizeDbError(error.message) }
  }

  return { data: (data ?? []) as FramerDirectoryEntry[], error: null }
}

export function filterFramerDirectory(
  entries: FramerDirectoryEntry[],
  query: string,
  excludeIds: Set<string>,
): FramerDirectoryEntry[] {
  const q = query.trim().toLowerCase()
  return entries.filter((row) => {
    if (excludeIds.has(row.id)) return false
    if (!q) return true
    return (
      row.display_name.toLowerCase().includes(q) ||
      row.email.toLowerCase().includes(q)
    )
  })
}

export function humanizeDbError(message: string): string {
  if (message.includes('PGRST205') || message.includes('schema cache')) {
    return 'SiteSafe data is temporarily unavailable. Try again later or contact your admin.'
  }
  if (message.includes('JWT') || message.includes('not authenticated')) {
    return 'Session expired. Sign in again.'
  }
  return message
}
