import { supabase } from '../lib/supabase'
import type {
  Profile,
  Site,
  Submission,
  SubmissionStatus,
  SubmissionWithDetails,
  SubmissionWithSite,
} from '../types/database'
import { humanizeDbError } from './sitesService'

type SiteSnippet = Pick<Site, 'id' | 'name' | 'address'>
type ProfileSnippet = Pick<Profile, 'id' | 'display_name'>

/** PostgREST may type an untyped FK embed as an array; normalize to one object. */
function normalizeSiteEmbed(
  sites: SiteSnippet | SiteSnippet[] | null | undefined,
): SiteSnippet | null {
  if (!sites) return null
  return Array.isArray(sites) ? (sites[0] ?? null) : sites
}

function normalizeProfileEmbed(
  profile: ProfileSnippet | ProfileSnippet[] | null | undefined,
): ProfileSnippet | null {
  if (!profile) return null
  return Array.isArray(profile) ? (profile[0] ?? null) : profile
}

function mapSubmissionRow(row: Record<string, unknown>): SubmissionWithSite {
  const { sites, ...rest } = row
  const base = rest as Omit<SubmissionWithSite, 'sites'>
  return {
    ...base,
    checklist: (base.checklist as Record<string, unknown> | undefined) ?? {},
    sites: normalizeSiteEmbed(sites as SiteSnippet | SiteSnippet[] | null),
  }
}

function mapAdminSubmissionRow(
  row: Record<string, unknown>,
): SubmissionWithDetails {
  const { sites, submitter, ...rest } = row
  const base = rest as Omit<SubmissionWithDetails, 'sites' | 'submitter'>
  return {
    ...base,
    checklist: (base.checklist as Record<string, unknown> | undefined) ?? {},
    sites: normalizeSiteEmbed(sites as SiteSnippet | SiteSnippet[] | null),
    submitter: normalizeProfileEmbed(
      submitter as ProfileSnippet | ProfileSnippet[] | null,
    ),
  }
}

export async function listMySubmissions(): Promise<{
  data: SubmissionWithSite[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      `
      id,
      site_id,
      submitted_by,
      status,
      checklist,
      notes,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      sites ( id, name, address )
    `,
    )
    .order('updated_at', { ascending: false })

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  return {
    data: (data ?? []).map((row) => mapSubmissionRow(row as Record<string, unknown>)),
    error: null,
  }
}

export async function getSubmission(id: string): Promise<{
  data: SubmissionWithDetails | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      `
      id,
      site_id,
      submitted_by,
      status,
      checklist,
      notes,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      sites ( id, name, address ),
      submitter:profiles!submissions_submitted_by_fkey ( id, display_name )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return { data: null, error: humanizeDbError(error.message) }
  }

  if (!data) return { data: null, error: null }

  return {
    data: mapAdminSubmissionRow(data as Record<string, unknown>),
    error: null,
  }
}

export interface CreateSubmissionInput {
  site_id: string
  submitted_by: string
  notes: string | null
  checklist?: Record<string, unknown>
  status: Extract<SubmissionStatus, 'draft' | 'submitted'>
}

export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<{ data: Submission | null; error: string | null }> {
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      site_id: input.site_id,
      submitted_by: input.submitted_by,
      notes: input.notes,
      checklist: input.checklist ?? {},
      status: input.status,
    })
    .select(
      'id, site_id, submitted_by, status, checklist, notes, reviewed_by, reviewed_at, created_at, updated_at',
    )
    .single()

  if (error) {
    return { data: null, error: humanizeDbError(error.message) }
  }

  return { data: data as Submission, error: null }
}

export interface UpdateSubmissionInput {
  site_id?: string
  notes?: string | null
  checklist?: Record<string, unknown>
  status?: SubmissionStatus
}

export async function updateSubmission(
  id: string,
  input: UpdateSubmissionInput,
): Promise<{ data: Submission | null; error: string | null }> {
  const { data, error } = await supabase
    .from('submissions')
    .update(input)
    .eq('id', id)
    .select(
      'id, site_id, submitted_by, status, checklist, notes, reviewed_by, reviewed_at, created_at, updated_at',
    )
    .single()

  if (error) {
    return { data: null, error: humanizeDbError(error.message) }
  }

  return { data: data as Submission, error: null }
}

export async function deleteDraftSubmission(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('submissions').delete().eq('id', id)
  if (error) {
    return { error: humanizeDbError(error.message) }
  }
  return { error: null }
}

/**
 * Admin Worker Submissions queue — excludes drafts.
 * Drafts are private to the owning framer (framer home / RLS); admins review
 * submitted work only.
 */
export async function listAdminSubmissions(): Promise<{
  data: SubmissionWithDetails[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      `
      id,
      site_id,
      submitted_by,
      status,
      checklist,
      notes,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      sites ( id, name, address ),
      submitter:profiles!submissions_submitted_by_fkey ( id, display_name )
    `,
    )
    .neq('status', 'draft')
    .order('updated_at', { ascending: false })

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  return {
    data: (data ?? []).map((row) =>
      mapAdminSubmissionRow(row as Record<string, unknown>),
    ),
    error: null,
  }
}

/** Admin: set review status and stamp reviewer. */
export async function reviewSubmission(
  id: string,
  status: Extract<
    SubmissionStatus,
    'under_review' | 'approved' | 'rejected'
  >,
  reviewerId: string,
): Promise<{ data: Submission | null; error: string | null }> {
  const { data, error } = await supabase
    .from('submissions')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(
      'id, site_id, submitted_by, status, checklist, notes, reviewed_by, reviewed_at, created_at, updated_at',
    )
    .single()

  if (error) {
    return { data: null, error: humanizeDbError(error.message) }
  }

  return { data: data as Submission, error: null }
}
