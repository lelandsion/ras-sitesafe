import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileDown } from 'lucide-react'
import { AdminNav } from '../../components/admin/AdminNav'
import { AppHeader } from '../../components/layout/AppHeader'
import { exportPeriodReportPdf } from '../../lib/exportPeriodReportPdf'
import { getSavedReport } from '../../services/savedReportsService'
import { periodLabel, type SavedReport } from '../../types/savedReport'

export function SavedReportViewPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<SavedReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) {
      setError('Missing report id.')
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await getSavedReport(id)
    if (result.error || !result.data) {
      setError(result.error ?? 'Report not found.')
      setReport(null)
    } else {
      setReport(result.data)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  function onExport() {
    if (!report) return
    exportPeriodReportPdf({
      siteName: report.site_name,
      year: report.period_year,
      month: report.period_month,
      title: report.title,
      options: report.options,
      summary: report.summary,
    })
  }

  return (
    <div className="app-shell app-shell--report">
      <AppHeader />
      <main className="app-main">
        <section className="report-preview-page" aria-labelledby="saved-report-title">
          <div className="report-preview-page__toolbar no-print">
            <Link to="/admin/reports" className="form-page__back touch-target">
              <ArrowLeft size={18} strokeWidth={2.5} aria-hidden />
              Reports
            </Link>
            <AdminNav />
            {report && (
              <button
                type="button"
                className="btn btn--primary touch-target"
                onClick={onExport}
              >
                <FileDown size={20} strokeWidth={2.5} aria-hidden />
                Export PDF
              </button>
            )}
          </div>

          {loading && (
            <div className="panel-state" role="status">
              Loading report…
            </div>
          )}

          {!loading && error && (
            <p className="form-banner form-banner--error" role="alert">
              {error}
            </p>
          )}

          {!loading && report && (
            <article className="report-document">
              <header className="report-document__header">
                <p className="report-document__brand">RAS SiteSafe</p>
                <h1 id="saved-report-title" className="report-document__title">
                  {report.title}
                </h1>
                <dl className="report-meta">
                  <div>
                    <dt>Site</dt>
                    <dd>{report.site_name}</dd>
                  </div>
                  <div>
                    <dt>Period</dt>
                    <dd>{periodLabel(report.period_year, report.period_month)}</dd>
                  </div>
                  <div>
                    <dt>Generated</dt>
                    <dd>{new Date(report.summary.generatedAt).toLocaleString()}</dd>
                  </div>
                </dl>
              </header>

              {report.options.safetySummary && (
                <section className="report-section">
                  <h3 className="report-section__title">Safety summary</h3>
                  <p className="report-line">
                    Daily checks: {report.summary.submissionCount}
                  </p>
                  <p className="report-line">
                    Avg compliance:{' '}
                    {report.summary.avgCompliance !== null
                      ? `${report.summary.avgCompliance}%`
                      : '—'}
                  </p>
                  <p className="report-line">Hazards: {report.summary.hazardCount}</p>
                  <p className="report-line">
                    Incidents: {report.summary.incidentCount}
                  </p>
                </section>
              )}

              {report.options.submissionCompliance && (
                <section className="report-section">
                  <h3 className="report-section__title">Submission compliance</h3>
                  <p className="report-line">
                    Open structured issues: {report.summary.openIssueCount}
                  </p>
                </section>
              )}

              {report.options.safetyIssues && report.summary.issueLines.length > 0 && (
                <section className="report-section">
                  <h3 className="report-section__title">Safety issues</h3>
                  <ul className="account-list">
                    {report.summary.issueLines.map((line) => (
                      <li key={line}>• {line}</li>
                    ))}
                  </ul>
                </section>
              )}

              {report.options.correctiveActions &&
                report.summary.correctiveLines.length > 0 && (
                  <section className="report-section">
                    <h3 className="report-section__title">Corrective actions</h3>
                    <ul className="account-list">
                      {report.summary.correctiveLines.map((line) => (
                        <li key={line}>• {line}</li>
                      ))}
                    </ul>
                  </section>
                )}

              {report.options.photos && (
                <section className="report-section">
                  <h3 className="report-section__title">Photos</h3>
                  <p className="report-line">
                    {report.summary.photoCount} photo(s) on checks in this period.
                  </p>
                </section>
              )}
            </article>
          )}
        </section>
      </main>
    </div>
  )
}
