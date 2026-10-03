import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileDown } from 'lucide-react'
import { AggregateReportView } from '../../components/admin/AggregateReportView'
import { AdminNav } from '../../components/admin/AdminNav'
import { AppHeader } from '../../components/layout/AppHeader'
import { exportPeriodReportPdf } from '../../lib/exportPeriodReportPdf'
import { monthBounds } from '../../lib/periodStats'
import { getSavedReport } from '../../services/savedReportsService'
import type { SavedReport } from '../../types/savedReport'

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

  const bounds = useMemo(() => {
    if (!report) return null
    return monthBounds(report.period_year, report.period_month)
  }, [report])

  async function onExport() {
    if (!report) return
    await exportPeriodReportPdf({
      siteName: report.site_name,
      year: report.period_year,
      month: report.period_month,
      title: report.title,
      options: report.options,
      summary: report.summary,
      fromDate: bounds?.fromDate,
      toDate: bounds?.toDate,
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
                onClick={() => void onExport()}
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

          {!loading && report && bounds && (
            <>
              <h2 id="saved-report-title" className="visually-hidden">
                Saved safety report
              </h2>
              <AggregateReportView
                siteName={report.site_name}
                year={report.period_year}
                month={report.period_month}
                fromDate={bounds.fromDate}
                toDate={bounds.toDate}
                options={report.options}
                summary={report.summary}
              />
            </>
          )}
        </section>
      </main>
    </div>
  )
}
