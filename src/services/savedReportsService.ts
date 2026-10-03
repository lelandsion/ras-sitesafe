import { supabase } from '../lib/supabase'
import { emptyAggregateSummary } from '../lib/periodStats'
import { humanizeDbError } from './sitesService'
import type {
  ReportIncludeOptions,
  SavedReport,
  SavedReportSummary,
  TopIssueCount,
} from '../types/savedReport'
import { DEFAULT_REPORT_INCLUDES } from '../types/savedReport'

const DEMO_STORAGE_KEY = 'ras-sitesafe-demo-saved-reports'

const TOP_NAMES: TopIssueCount['name'][] = [
  'Fall Protection',
  'PPE',
  'Housekeeping',
  'Tools',
]

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

function parseTopIssues(raw: unknown): TopIssueCount[] {
  const defaults = TOP_NAMES.map((name) => ({ name, count: 0 }))
  if (!Array.isArray(raw)) return defaults
  const map = new Map<string, number>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const name = String(row.name ?? '')
    map.set(name, Number(row.count ?? 0))
  }
  return TOP_NAMES.map((name) => ({
    name,
    count: map.get(name) ?? 0,
  }))
}

function parseSeries(
  raw: unknown,
  valueKey: 'compliance' | 'issues',
): { date: string; compliance: number; issues: number }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const date = String(row.date ?? '')
      if (!date) return null
      return {
        date,
        compliance: Number(row.compliance ?? 0),
        issues: Number(row.issues ?? 0),
        [valueKey]: Number(row[valueKey] ?? 0),
      }
    })
    .filter((x): x is { date: string; compliance: number; issues: number } => Boolean(x))
}

function parseSummary(raw: unknown): SavedReportSummary {
  const empty = emptyAggregateSummary()
  if (!raw || typeof raw !== 'object') return empty
  const s = raw as Record<string, unknown>
  const issueLines = Array.isArray(s.issueLines) ? (s.issueLines as string[]) : []
  const notable = Array.isArray(s.notableIssues)
    ? (s.notableIssues as string[])
    : issueLines
  return {
    submissionCount: Number(s.submissionCount ?? 0),
    avgCompliance:
      s.avgCompliance === null || s.avgCompliance === undefined
        ? null
        : Number(s.avgCompliance),
    hazardCount: Number(s.hazardCount ?? 0),
    incidentCount: Number(s.incidentCount ?? 0),
    openIssueCount: Number(s.openIssueCount ?? 0),
    issueLines,
    correctiveLines: Array.isArray(s.correctiveLines)
      ? (s.correctiveLines as string[])
      : [],
    photoCount: Number(s.photoCount ?? 0),
    generatedAt: String(s.generatedAt ?? new Date().toISOString()),
    expectedSubmissions: Number(s.expectedSubmissions ?? s.submissionCount ?? 0),
    missingSubmissions: Number(s.missingSubmissions ?? 0),
    completionPct:
      s.completionPct === null || s.completionPct === undefined
        ? s.avgCompliance === null || s.avgCompliance === undefined
          ? null
          : Number(s.avgCompliance)
        : Number(s.completionPct),
    expectedIsEstimate: s.expectedIsEstimate !== false,
    safetyIssueCount: Number(s.safetyIssueCount ?? s.openIssueCount ?? 0),
    highPriorityCount: Number(s.highPriorityCount ?? 0),
    nearMissCount: Number(s.nearMissCount ?? s.incidentCount ?? 0),
    resolvedIssueCount: Number(s.resolvedIssueCount ?? 0),
    topIssues: parseTopIssues(s.topIssues),
    complianceSeries: parseSeries(s.complianceSeries, 'compliance').map((r) => ({
      date: r.date,
      compliance: r.compliance,
    })),
    issuesSeries: parseSeries(s.issuesSeries, 'issues').map((r) => ({
      date: r.date,
      issues: r.issues,
    })),
    notableIssues: notable,
    appendixIssues: Array.isArray(s.appendixIssues)
      ? (s.appendixIssues as SavedReportSummary['appendixIssues'])
      : issueLines.map((line) => ({
          date: '',
          workerName: '',
          category: 'Issue',
          summary: line,
          severity: null,
          status: '',
        })),
    appendixPhotos: Array.isArray(s.appendixPhotos)
      ? (s.appendixPhotos as SavedReportSummary['appendixPhotos'])
      : [],
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
    return Array.isArray(parsed) ? parsed.map((r) => ({
      ...r,
      summary: parseSummary(r.summary),
      options: parseOptions(r.options),
    })) : []
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
        ...emptyAggregateSummary(),
        submissionCount: 18,
        avgCompliance: 92,
        hazardCount: 2,
        incidentCount: 0,
        openIssueCount: 3,
        issueLines: ['PPE: Hard hat — No on 2 checks'],
        correctiveLines: ['Review PPE signage at site entrance.'],
        photoCount: 6,
        expectedSubmissions: 22,
        missingSubmissions: 4,
        completionPct: 82,
        expectedIsEstimate: true,
        safetyIssueCount: 8,
        highPriorityCount: 1,
        nearMissCount: 0,
        resolvedIssueCount: 5,
        topIssues: [
          { name: 'Fall Protection', count: 3 },
          { name: 'PPE', count: 2 },
          { name: 'Housekeeping', count: 2 },
          { name: 'Tools', count: 1 },
        ],
        complianceSeries: [
          { date: '2026-10-06', compliance: 90 },
          { date: '2026-10-13', compliance: 93 },
        ],
        issuesSeries: [
          { date: '2026-10-06', issues: 2 },
          { date: '2026-10-13', issues: 1 },
        ],
        notableIssues: ['PPE: Hard hat — No on 2 checks'],
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
        ...emptyAggregateSummary(),
        submissionCount: 14,
        avgCompliance: 88,
        hazardCount: 1,
        incidentCount: 1,
        openIssueCount: 2,
        photoCount: 4,
        expectedSubmissions: 20,
        missingSubmissions: 6,
        completionPct: 70,
        expectedIsEstimate: true,
        safetyIssueCount: 5,
        highPriorityCount: 0,
        nearMissCount: 1,
        resolvedIssueCount: 3,
        topIssues: [
          { name: 'Fall Protection', count: 1 },
          { name: 'PPE', count: 1 },
          { name: 'Housekeeping', count: 1 },
          { name: 'Tools', count: 0 },
        ],
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
