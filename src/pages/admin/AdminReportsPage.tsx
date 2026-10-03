import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileBarChart, RefreshCw } from 'lucide-react'
import { AggregateReportView } from '../../components/admin/AggregateReportView'
import { AdminNav } from '../../components/admin/AdminNav'
import { AppHeader } from '../../components/layout/AppHeader'
import { useAuth } from '../../hooks/auth-context'
import { buildPeriodReportSummary } from '../../lib/buildPeriodReport'
import { exportPeriodReportPdf } from '../../lib/exportPeriodReportPdf'
import { defaultPeriodRange, monthBounds } from '../../lib/periodStats'
import { listAdminSites } from '../../services/sitesService'
import {
  createSavedReport,
  listSavedReports,
  seedDemoSavedReportsIfEmpty,
} from '../../services/savedReportsService'
import type { Site } from '../../types/database'
import {
  DEFAULT_REPORT_INCLUDES,
  formatReportListDate,
  periodLabel,
  type ReportIncludeOptions,
  type SavedReport,
  type SavedReportSummary,
} from '../../types/savedReport'

type IncludeKey = keyof ReportIncludeOptions

const INCLUDE_LABELS: Record<IncludeKey, string> = {
  safetySummary: 'Safety summary',
  submissionCompliance: 'Submission compliance',
  safetyIssues: 'Safety issues',
  correctiveActions: 'Corrective actions',
  photos: 'Photos',
}

function periodFromDates(fromDate: string, toDate: string): {
  year: number
  month: number
} {
  const [y, m] = fromDate.split('-').map(Number)
  if (y && m) return { year: y, month: m }
  const [y2, m2] = toDate.split('-').map(Number)
  return { year: y2 || new Date().getFullYear(), month: m2 || 1 }
}

export function AdminReportsPage() {
  const { user } = useAuth()
  const defaults = useMemo(() => defaultPeriodRange(), [])
  const [sites, setSites] = useState<Site[]>([])
  const [saved, setSaved] = useState<SavedReport[]>([])
  const [siteId, setSiteId] = useState('')
  const [fromDate, setFromDate] = useState(defaults.fromDate)
  const [toDate, setToDate] = useState(defaults.toDate)
  const [includes, setIncludes] = useState<ReportIncludeOptions>({
    ...DEFAULT_REPORT_INCLUDES,
  })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    siteName: string
    year: number
    month: number
    fromDate: string
    toDate: string
    summary: SavedReportSummary
    usedDemoFallback: boolean
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const sitesResult = await listAdminSites()
    if (sitesResult.error) {
      setError(sitesResult.error)
      setLoading(false)
      return
    }
    const active = sitesResult.data.filter((s) => s.is_active)
    setSites(active)
    setSiteId((prev) => {
      if (prev && active.some((s) => s.id === prev)) return prev
      const royal = active.find((s) =>
        s.name.toLowerCase().includes('royal commons'),
      )
      return royal?.id || active[0]?.id || ''
    })

    seedDemoSavedReportsIfEmpty(active.map((s) => s.name))
    const listResult = await listSavedReports()
    if (listResult.error) {
      setError(listResult.error)
    } else {
      setSaved(listResult.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function onMonthPresetChange(value: string) {
    const [ys, ms] = value.split('-').map(Number)
    if (!ys || !ms) return
    const bounds = monthBounds(ys, ms)
    setFromDate(bounds.fromDate)
    setToDate(bounds.toDate)
  }

  const monthPreset = useMemo(() => {
    const { year, month } = periodFromDates(fromDate, toDate)
    return `${year}-${month}`
  }, [fromDate, toDate])

  const monthOptions = useMemo(() => {
    const out: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      out.push({
        value: `${year}-${month}`,
        label: periodLabel(year, month),
      })
    }
    return out
  }, [])

  async function onGenerate() {
    if (!user?.id || !siteId) return
    const site = sites.find((s) => s.id === siteId)
    if (!site) return
    if (fromDate > toDate) {
      setError('Period start must be on or before the end date.')
      return
    }

    const { year, month } = periodFromDates(fromDate, toDate)

    setGenerating(true)
    setError(null)
    setInfo(null)

    try {
      const { summary, usedDemoFallback } = await buildPeriodReportSummary({
        siteId,
        siteName: site.name,
        year,
        month,
        fromDate,
        toDate,
        options: includes,
        allowDemoFallback: true,
      })

      const title = 'Monthly Safety Report'
      const { data, error: saveError } = await createSavedReport({
        createdBy: user.id,
        siteId,
        siteName: site.name,
        periodYear: year,
        periodMonth: month,
        title,
        options: includes,
        summary,
      })

      if (saveError || !data) {
        setError(saveError ?? 'Could not save report.')
        setGenerating(false)
        return
      }

      setPreview({
        siteName: site.name,
        year,
        month,
        fromDate,
        toDate,
        summary,
        usedDemoFallback,
      })

      await exportPeriodReportPdf({
        siteName: site.name,
        year,
        month,
        title,
        options: includes,
        summary,
        fromDate,
        toDate,
      })

      setSaved((prev) => [data, ...prev.filter((r) => r.id !== data.id)])
      setInfo(
        usedDemoFallback
          ? 'Report generated with demo aggregate stats (no live submissions in range) and saved.'
          : 'Report generated from live submissions and saved.',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate report.')
    }
    setGenerating(false)
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="admin-reports" aria-labelledby="reports-title">
          <div className="admin-dash__head">
            <div>
              <p className="admin-dash__kicker">Admin</p>
              <h2 id="reports-title" className="admin-dash__title">
                Reports
                <span>Site period safety packages</span>
              </h2>
              <AdminNav />
            </div>
            <button
              type="button"
              className="btn btn--ghost touch-target"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={20} strokeWidth={2.5} aria-hidden />
              Refresh
            </button>
          </div>

          {error && (
            <p className="form-banner form-banner--error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="form-banner form-banner--ok" role="status">
              {info}
            </p>
          )}

          <div className="admin-panel">
            <h3 className="admin-panel__title">Create report</h3>
            <div className="report-create-grid">
              <label className="safety-form__field">
                <span>Site</span>
                <select
                  className="safety-form__control touch-target"
                  value={siteId}
                  disabled={loading || sites.length === 0}
                  onChange={(e) => setSiteId(e.target.value)}
                  data-testid="report-site"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="safety-form__field">
                <span>Month preset</span>
                <select
                  className="safety-form__control touch-target"
                  value={monthPreset}
                  onChange={(e) => onMonthPresetChange(e.target.value)}
                >
                  {monthOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="report-period-row" data-testid="report-period">
              <label className="safety-form__field">
                <span>Period</span>
                <input
                  type="date"
                  className="safety-form__control touch-target"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  data-testid="report-from"
                />
              </label>
              <span className="report-period-row__sep" aria-hidden>
                —
              </span>
              <label className="safety-form__field">
                <span className="visually-hidden">Period end</span>
                <input
                  type="date"
                  className="safety-form__control touch-target"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  data-testid="report-to"
                />
              </label>
            </div>

            <fieldset className="report-include-fieldset">
              <legend>Include</legend>
              {(Object.keys(INCLUDE_LABELS) as IncludeKey[]).map((key) => (
                <label key={key} className="report-include-option touch-target">
                  <input
                    type="checkbox"
                    checked={includes[key]}
                    onChange={(e) =>
                      setIncludes((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                  />
                  <span>{INCLUDE_LABELS[key]}</span>
                </label>
              ))}
            </fieldset>

            <button
              type="button"
              className="btn btn--primary touch-target"
              disabled={generating || !siteId || loading}
              onClick={() => void onGenerate()}
              data-testid="generate-report"
            >
              <FileBarChart size={20} strokeWidth={2.5} aria-hidden />
              {generating ? 'Generating…' : 'Generate Report'}
            </button>
          </div>

          {preview && (
            <div className="admin-panel admin-panel--flush">
              <AggregateReportView
                siteName={preview.siteName}
                year={preview.year}
                month={preview.month}
                fromDate={preview.fromDate}
                toDate={preview.toDate}
                options={includes}
                summary={preview.summary}
                usedDemoFallback={preview.usedDemoFallback}
              />
            </div>
          )}

          <div className="admin-panel">
            <h3 className="admin-panel__title">Saved reports</h3>
            {loading && (
              <p className="admin-panel__empty" role="status">
                Loading…
              </p>
            )}
            {!loading && saved.length === 0 && (
              <p className="admin-panel__empty">
                No saved reports yet. Generate one above.
              </p>
            )}
            {!loading && saved.length > 0 && (
              <ul className="saved-report-list">
                {saved.map((report) => (
                  <li key={report.id} className="saved-report-row">
                    <div className="saved-report-row__main">
                      <p className="saved-report-row__site">{report.site_name}</p>
                      <p className="saved-report-row__period">
                        {periodLabel(report.period_year, report.period_month)}
                      </p>
                      <p className="saved-report-row__date">
                        {formatReportListDate(report.created_at)}
                      </p>
                      <p className="saved-report-row__title">{report.title}</p>
                    </div>
                    <Link
                      to={`/admin/reports/${report.id}`}
                      className="btn btn--ghost touch-target"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Reports
      </footer>
    </div>
  )
}
