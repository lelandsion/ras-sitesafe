import { supabase } from '../lib/supabase'
import { humanizeDbError } from './sitesService'
import type {
  ReportIncludeOptions,
  SavedReport,
  SavedReportSummary,
} from '../types/savedReport'
import { DEFAULT_REPORT_INCLUDES } from '../types/savedReport'

const DEMO_STORAGE_KEY = 'ras-sitesafe-demo-saved-reports'

function parseOptions(raw: unknown): ReportIncludeOptions {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_REPORT_INCLUDES }
  const o = raw as Record<string, unknown>
  return {
    safetySummary: o.safetySummary !== false,
    submissionCompliance: o.submissionCompliance !== false,
    safetyIssues: o.safetyIssues !== false,
    correctiveActions: o.correctiveActions !== false,
    photos: o.photos !== false,
  }
}

function parseSummary(raw: unknown): SavedReportSummary {
  if (!raw || typeof raw !== 'object') {
    return {
      submissionCount: 0,
      avgCompliance: null,
      hazardCount: 0,
      incidentCount: 0,
      openIssueCount: 0,
      issueLines: [],
      correctiveLines: [],
      photoCount: 0,
      generatedAt: new Date().toISOString(),
    }
  }
  const s = raw as Record<string, unknown>
  return {
    submissionCount: Number(s.submissionCount ?? 0),
    avgCompliance:
      s.avgCompliance === null || s.avgCompliance === undefined
        ? null
        : Number(s.avgCompliance),
    hazardCount: Number(s.hazardCount ?? 0),
    incidentCount: Number(s.incidentCount ?? 0),
    openIssueCount: Number(s.openIssueCount ?? 0),
    issueLines: Array.isArray(s.issueLines) ? (s.issueLines as string[]) : [],
    correctiveLines: Array.isArray(s.correctiveLines)
      ? (s.correctiveLines as string[])
      : [],
    photoCount: Number(s.photoCount ?? 0),
    generatedAt: String(s.generatedAt ?? new Date().toISOString()),
  }
}

function mapRow(row: Record<string, unknown>): SavedReport {
  return {
    id: String(row.id),
    created_by: String(row.created_by),
    site_id: row.site_id ? String(row.site_id) : null,
    site_name: String(row.site_name),
    period_year: Number(row.period_year),
    period_month: Number(row.period_month),
    title: String(row.title),
    options: parseOptions(row.options),
    summary: parseSummary(row.summary),
    created_at: String(row.created_at),
  }
}

function demoReports(): SavedReport[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedReport[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistDemoReports(reports: SavedReport[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(reports))
}

export function seedDemoSavedReportsIfEmpty(siteNames: string[]): void {
  const existing = demoReports()
  if (existing.length > 0) return
  if (siteNames.length === 0) return

  const now = new Date()
  const seeds: SavedReport[] = [
    {
      id: `demo-${crypto.randomUUID()}`,
      created_by: 'demo',
      site_id: null,
      site_name: siteNames[0] ?? 'Royal Commons',
      period_year: now.getFullYear(),
      period_month: now.getMonth() + 1,
      title: 'Monthly Safety Report',
      options: { ...DEFAULT_REPORT_INCLUDES },
      summary: {
        submissionCount: 18,
        avgCompliance: 92,
        hazardCount: 2,
        incidentCount: 0,
        openIssueCount: 3,
        issueLines: ['PPE: Hard hat — No on 2 checks'],
        correctiveLines: ['Review PPE signage at site entrance.'],
        photoCount: 6,
        generatedAt: now.toISOString(),
      },
      created_at: now.toISOString(),
    },
  ]
  if (siteNames[1]) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 28)
    seeds.push({
      id: `demo-${crypto.randomUUID()}`,
      created_by: 'demo',
      site_id: null,
      site_name: siteNames[1],
      period_year: prev.getFullYear(),
      period_month: prev.getMonth() + 1,
      title: 'Monthly Safety Report',
      options: { ...DEFAULT_REPORT_INCLUDES },
      summary: {
        submissionCount: 14,
        avgCompliance: 88,
        hazardCount: 1,
        incidentCount: 1,
        openIssueCount: 2,
        issueLines: [],
        correctiveLines: [],
        photoCount: 4,
        generatedAt: prev.toISOString(),
      },
      created_at: prev.toISOString(),
    })
  }
  persistDemoReports(seeds)
}

export async function listSavedReports(): Promise<{
  data: SavedReport[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('saved_reports')
    .select(
      'id, created_by, site_id, site_name, period_year, period_month, title, options, summary, created_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('saved_reports') || msg.includes('schema cache')) {
      return { data: demoReports(), error: null }
    }
    return { data: [], error: humanizeDbError(error.message) }
  }

  const mapped = (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
  if (mapped.length === 0) {
    return { data: demoReports(), error: null }
  }
  return { data: mapped, error: null }
}

export async function getSavedReport(id: string): Promise<{
  data: SavedReport | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('saved_reports')
    .select(
      'id, created_by, site_id, site_name, period_year, period_month, title, options, summary, created_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    const demo = demoReports().find((r) => r.id === id) ?? null
    if (demo) return { data: demo, error: null }
    return { data: null, error: humanizeDbError(error.message) }
  }

  if (!data) {
    const demo = demoReports().find((r) => r.id === id) ?? null
    return { data: demo, error: null }
  }

  return { data: mapRow(data as Record<string, unknown>), error: null }
}

export async function createSavedReport(input: {
  createdBy: string
  siteId: string
  siteName: string
  periodYear: number
  periodMonth: number
  title: string
  options: ReportIncludeOptions
  summary: SavedReportSummary
}): Promise<{ data: SavedReport | null; error: string | null }> {
  const { data, error } = await supabase
    .from('saved_reports')
    .insert({
      created_by: input.createdBy,
      site_id: input.siteId,
      site_name: input.siteName,
      period_year: input.periodYear,
      period_month: input.periodMonth,
      title: input.title,
      options: input.options,
      summary: input.summary,
    })
    .select(
      'id, created_by, site_id, site_name, period_year, period_month, title, options, summary, created_at',
    )
    .single()

  if (error) {
    const fallback: SavedReport = {
      id: crypto.randomUUID(),
      created_by: input.createdBy,
      site_id: input.siteId,
      site_name: input.siteName,
      period_year: input.periodYear,
      period_month: input.periodMonth,
      title: input.title,
      options: input.options,
      summary: input.summary,
      created_at: new Date().toISOString(),
    }
    const next = [fallback, ...demoReports()]
    persistDemoReports(next)
    return { data: fallback, error: null }
  }

  return { data: mapRow(data as Record<string, unknown>), error: null }
}
