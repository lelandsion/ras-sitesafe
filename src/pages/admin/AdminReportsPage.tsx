import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileBarChart, RefreshCw } from 'lucide-react'
import { AdminNav } from '../../components/admin/AdminNav'
import { AppHeader } from '../../components/layout/AppHeader'
import { useAuth } from '../../hooks/auth-context'
import { buildPeriodReportSummary } from '../../lib/buildPeriodReport'
import { exportPeriodReportPdf } from '../../lib/exportPeriodReportPdf'
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
} from '../../types/savedReport'

function monthOptions(): { value: string; label: string; year: number; month: number }[] {
  const out: { value: string; label: string; year: number; month: number }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    out.push({
      value: `${year}-${month}`,
      label: periodLabel(year, month),
      year,
      month,
    })
  }
  return out
}

type IncludeKey = keyof ReportIncludeOptions

const INCLUDE_LABELS: Record<IncludeKey, string> = {
  safetySummary: 'Safety summary',
  submissionCompliance: 'Submission compliance',
  safetyIssues: 'Safety issues',
  correctiveActions: 'Corrective actions',
  photos: 'Photos',
}

export function AdminReportsPage() {
  const { user } = useAuth()
  const [sites, setSites] = useState<Site[]>([])
  const [saved, setSaved] = useState<SavedReport[]>([])
  const [siteId, setSiteId] = useState('')
  const [periodValue, setPeriodValue] = useState(monthOptions()[0]?.value ?? '')
  const [includes, setIncludes] = useState<ReportIncludeOptions>({
    ...DEFAULT_REPORT_INCLUDES,
  })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const periods = useMemo(() => monthOptions(), [])

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
    setSiteId((prev) => prev || active[0]?.id || '')

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

  async function onGenerate() {
    if (!user?.id || !siteId) return
    const site = sites.find((s) => s.id === siteId)
    if (!site) return
    const period = periods.find((p) => p.value === periodValue) ?? periods[0]
    if (!period) return

    setGenerating(true)
    setError(null)
    setInfo(null)

    try {
      const { summary } = await buildPeriodReportSummary({
        siteId,
        year: period.year,
        month: period.month,
        options: includes,
      })

      const title = 'Monthly Safety Report'
      const { data, error: saveError } = await createSavedReport({
        createdBy: user.id,
        siteId,
        siteName: site.name,
        periodYear: period.year,
        periodMonth: period.month,
        title,
        options: includes,
        summary,
      })

      if (saveError || !data) {
        setError(saveError ?? 'Could not save report.')
        setGenerating(false)
        return
      }

      exportPeriodReportPdf({
        siteName: site.name,
        year: period.year,
        month: period.month,
        title,
        options: includes,
        summary,
      })

      setSaved((prev) => [data, ...prev.filter((r) => r.id !== data.id)])
      setInfo('Report generated and saved.')
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
                <span>Monthly site safety packages</span>
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
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="safety-form__field">
                <span>Reporting period</span>
                <select
                  className="safety-form__control touch-target"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                >
                  {periods.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
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
            >
              <FileBarChart size={20} strokeWidth={2.5} aria-hidden />
              {generating ? 'Generating…' : 'Generate report'}
            </button>
          </div>

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
