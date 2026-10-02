import { supabase } from '../lib/supabase'
import type {
  FramerDirectoryEntry,
  Site,
  SiteAssignmentWithFramer,
  SiteWithAssignmentCount,
} from '../types/database'

export type SiteUpsertInput = {
  name: string
  address: string | null
  is_active: boolean
}

type SiteRowWithCount = Site & {
  site_assignments: { count: number }[] | null
}

function mapSiteWithCount(row: SiteRowWithCount): SiteWithAssignmentCount {
  const count = row.site_assignments?.[0]?.count ?? 0
  const { site_assignments: _ignored, ...site } = row
  return { ...site, assignment_count: count }
}

/**
 * Sites the signed-in framer is assigned to (RLS filters; join via site_assignments).
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

/** All sites for admin (includes inactive) with assignment counts. */
export async function listAdminSites(): Promise<{
  data: SiteWithAssignmentCount[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('sites')
    .select(
      'id, name, address, is_active, created_at, updated_at, site_assignments(count)',
    )
    .order('name', { ascending: true })

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  return {
    data: ((data ?? []) as SiteRowWithCount[]).map(mapSiteWithCount),
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
  const { data, error } = await supabase
    .from('site_assignments')
    .select(
      'id, site_id, framer_id, assigned_at, framer:profiles!site_assignments_framer_id_fkey ( id, display_name )',
    )
    .eq('site_id', siteId)
    .order('assigned_at', { ascending: true })

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  const rows = (data ?? []).map((row) => {
    const framer = row.framer
    const normalized =
      framer && Array.isArray(framer)
        ? (framer[0] ?? null)
        : (framer as SiteAssignmentWithFramer['framer'])
    return { ...row, framer: normalized }
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
  const { error } = await supabase
    .from('site_assignments')
    .delete()
    .eq('id', assignmentId)

  if (error) {
    return { error: humanizeDbError(error.message) }
  }

  return { error: null }
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
          'Framer search is not available yet. Apply supabase/migrations/20261002000200_admin_framer_directory.sql in Supabase, then refresh.',
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
    return 'Database tables are not applied yet. Run the SQL migration in Supabase (docs/supabase-seed-notes.md), then refresh.'
  }
  if (message.includes('JWT') || message.includes('not authenticated')) {
    return 'Session expired. Sign in again.'
  }
  return message
}
