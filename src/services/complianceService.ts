import { supabase } from '../lib/supabase'
import {
  buildComplianceRows,
  summarizeCompliance,
  type ComplianceSubmissionSnippet,
  type ComplianceSummary,
  type ComplianceWorkerRow,
} from '../lib/dailyCompliance'
import type { SiteAssignmentWithFramer } from '../types/database'
import { humanizeDbError } from './sitesService'

/** All assignment history for a site (active + past), for date-window Missing. */
export async function listSiteAssignmentHistory(
  siteId: string,
): Promise<{ data: SiteAssignmentWithFramer[]; error: string | null }> {
  const { data, error } = await supabase
    .from('site_assignments')
    .select(
      'id, site_id, framer_id, assigned_at, unassigned_at, framer:profiles!site_assignments_framer_id_fkey ( id, display_name )',
    )
    .eq('site_id', siteId)
    .order('assigned_at', { ascending: true })

  if (error) {
    // Column missing before Part 8 — fall back without unassigned_at.
    if (
      error.message.includes('unassigned_at') ||
      error.message.includes('schema cache')
    ) {
      const legacy = await supabase
        .from('site_assignments')
        .select(
          'id, site_id, framer_id, assigned_at, framer:profiles!site_assignments_framer_id_fkey ( id, display_name )',
        )
        .eq('site_id', siteId)
        .order('assigned_at', { ascending: true })
      if (legacy.error) {
        return { data: [], error: humanizeDbError(legacy.error.message) }
      }
      const rows = (legacy.data ?? []).map((row) => {
        const framer = row.framer
        const normalized =
          framer && Array.isArray(framer)
            ? (framer[0] ?? null)
            : (framer as SiteAssignmentWithFramer['framer'])
        return {
          ...row,
          unassigned_at: null,
          framer: normalized,
        }
      })
      return { data: rows as SiteAssignmentWithFramer[], error: null }
    }
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

async function listSiteSubmissions(
  siteId: string,
): Promise<{ data: ComplianceSubmissionSnippet[]; error: string | null }> {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id, site_id, submitted_by, status, checklist, created_at, updated_at',
    )
    .eq('site_id', siteId)
    .neq('status', 'draft')

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  return {
    data: (data ?? []) as ComplianceSubmissionSnippet[],
    error: null,
  }
}

export async function loadSiteDailyCompliance(params: {
  siteId: string
  dateISO: string
}): Promise<{
  rows: ComplianceWorkerRow[]
  summary: ComplianceSummary
  error: string | null
}> {
  const [assignResult, subResult] = await Promise.all([
    listSiteAssignmentHistory(params.siteId),
    listSiteSubmissions(params.siteId),
  ])

  if (assignResult.error) {
    return {
      rows: [],
      summary: { assigned: 0, submitted: 0, missing: 0, issues: 0 },
      error: assignResult.error,
    }
  }
  if (subResult.error) {
    return {
      rows: [],
      summary: { assigned: 0, submitted: 0, missing: 0, issues: 0 },
      error: subResult.error,
    }
  }

  const rows = buildComplianceRows({
    assignments: assignResult.data,
    siteId: params.siteId,
    dateISO: params.dateISO,
    submissions: subResult.data,
  })

  return { rows, summary: summarizeCompliance(rows), error: null }
}

export type SiteComplianceOverview = {
  siteId: string
  siteName: string
  summary: ComplianceSummary
}

/** Dashboard strip: today's compliance across all sites. */
export async function loadTodayComplianceOverview(dateISO: string): Promise<{
  overall: ComplianceSummary
  sites: SiteComplianceOverview[]
  error: string | null
}> {
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (sitesError) {
    return {
      overall: { assigned: 0, submitted: 0, missing: 0, issues: 0 },
      sites: [],
      error: humanizeDbError(sitesError.message),
    }
  }

  const overviews: SiteComplianceOverview[] = []
  const overall: ComplianceSummary = {
    assigned: 0,
    submitted: 0,
    missing: 0,
    issues: 0,
  }

  for (const site of sites ?? []) {
    const { rows, summary, error } = await loadSiteDailyCompliance({
      siteId: site.id,
      dateISO,
    })
    if (error) {
      return {
        overall: { assigned: 0, submitted: 0, missing: 0, issues: 0 },
        sites: [],
        error,
      }
    }
    if (summary.assigned === 0 && rows.length === 0) continue
    overviews.push({
      siteId: site.id,
      siteName: site.name,
      summary,
    })
    overall.assigned += summary.assigned
    overall.submitted += summary.submitted
    overall.missing += summary.missing
    overall.issues += summary.issues
  }

  return { overall, sites: overviews, error: null }
}
