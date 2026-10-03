import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getPhotoSignedUrl } from '../../services/photosService'
import {
  formatReportRangeLabel,
  periodLabel,
  safetyReportHeading,
  type ReportIncludeOptions,
  type SavedReportSummary,
} from '../../types/savedReport'

type Props = {
  siteName: string
  year: number
  month: number
  fromDate: string
  toDate: string
  options: ReportIncludeOptions
  summary: SavedReportSummary
  usedDemoFallback?: boolean
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="agg-stat">
      <p className="agg-stat__value">{value}</p>
      <p className="agg-stat__label">{label}</p>
      {hint ? <p className="agg-stat__hint">{hint}</p> : null}
    </div>
  )
}

type ResolvedPhoto = {
  id: string
  url: string | null
  kind: string
  checkDate: string
  workerName: string
}

export function AggregateReportView({
  siteName,
  year,
  month,
  fromDate,
  toDate,
  options,
  summary,
  usedDemoFallback,
}: Props) {
  const complianceBar = [
    { name: 'Expected', count: summary.expectedSubmissions },
    { name: 'Submitted', count: summary.submissionCount },
    { name: 'Missing', count: summary.missingSubmissions },
  ]

  const appendixIssues = summary.appendixIssues ?? []
  const appendixPhotos = summary.appendixPhotos ?? []
  const showAppendix =
    (options.safetyIssues && appendixIssues.length > 0) ||
    (options.photos && (appendixPhotos.length > 0 || summary.photoCount > 0))

  const [appendixOpen, setAppendixOpen] = useState(true)
  const [resolvedPhotos, setResolvedPhotos] = useState<ResolvedPhoto[]>([])
  useEffect(() => {
    const photos = summary.appendixPhotos ?? []
    if (!options.photos || photos.length === 0) {
      setResolvedPhotos([])
      return
    }
    let cancelled = false
    void (async () => {
      const next: ResolvedPhoto[] = []
      for (const photo of photos) {
        const { url } = await getPhotoSignedUrl(photo.storagePath)
        if (cancelled) return
        next.push({
          id: photo.id,
          url,
          kind: photo.kind,
          checkDate: photo.checkDate,
          workerName: photo.workerName,
        })
      }
      if (!cancelled) setResolvedPhotos(next)
    })()
    return () => {
      cancelled = true
    }
  }, [options.photos, summary.appendixPhotos])

  return (
    <article className="report-document aggregate-report" data-testid="aggregate-report">
      <header className="report-document__header aggregate-report__header">
        <div className="aggregate-report__brand-band">
          <div>
            <p className="report-document__brand">RAS SiteSafe</p>
            <p className="aggregate-report__subtitle">Monthly Safety Report</p>
          </div>
          <div className="aggregate-report__brand-meta">
            <span>{siteName}</span>
            <span>{periodLabel(year, month)}</span>
          </div>
        </div>
        <h1 className="report-document__title">
          {safetyReportHeading(siteName, year, month)}
        </h1>
        <dl className="report-meta report-meta--table">
          <div>
            <dt>Site</dt>
            <dd>{siteName}</dd>
          </div>
          <div>
            <dt>Period</dt>
            <dd>
              {periodLabel(year, month)}
              <span className="report-meta__sub">
                {formatReportRangeLabel(fromDate, toDate)}
              </span>
            </dd>
          </div>
          <div>
            <dt>Range</dt>
            <dd>{formatReportRangeLabel(fromDate, toDate)}</dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{new Date(summary.generatedAt).toLocaleString()}</dd>
          </div>
        </dl>
        {usedDemoFallback && (
          <p className="agg-demo-note" role="status">
            No live submissions in this range — showing demo aggregate figures so
            you can review the report layout.
          </p>
        )}
      </header>

      {options.submissionCompliance && (
        <section className="report-section">
          <h3 className="report-section__title report-section__title--accent">
            Submission compliance
          </h3>
          <div className="agg-stat-grid" data-testid="agg-compliance">
            <StatTile
              label="Expected"
              value={summary.expectedSubmissions}
              hint={
                summary.expectedIsEstimate
                  ? 'Estimated (weekdays × workers)'
                  : 'Weekdays × assigned framers'
              }
            />
            <StatTile label="Submitted" value={summary.submissionCount} />
            <StatTile label="Missing" value={summary.missingSubmissions} />
            <StatTile
              label="Completion %"
              value={
                summary.completionPct !== null ? `${summary.completionPct}%` : '—'
              }
            />
          </div>
        </section>
      )}

      {options.safetySummary && (
        <section className="report-section">
          <h3 className="report-section__title report-section__title--accent">Safety</h3>
          <div className="agg-stat-grid" data-testid="agg-safety">
            <StatTile label="Safety issues" value={summary.safetyIssueCount} />
            <StatTile label="High priority" value={summary.highPriorityCount} />
            <StatTile label="Near misses" value={summary.nearMissCount} />
            <StatTile label="Open issues" value={summary.openIssueCount} />
            <StatTile label="Resolved" value={summary.resolvedIssueCount} />
            {summary.avgCompliance !== null && (
              <StatTile label="Avg checklist %" value={`${summary.avgCompliance}%`} />
            )}
          </div>
        </section>
      )}

      {options.safetyIssues && (
        <section className="report-section">
          <h3 className="report-section__title report-section__title--accent">
            Top issues
          </h3>
          <ul className="agg-top-issues" data-testid="agg-top-issues">
            {summary.topIssues.map((item) => (
              <li key={item.name} className="agg-top-issues__row">
                <span>{item.name}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(options.submissionCompliance || options.safetyIssues) && (
        <section className="report-section">
          <h3 className="report-section__title report-section__title--accent">Charts</h3>
          <div className="agg-charts">
            {options.submissionCompliance && (
              <div
                className="admin-chart"
                role="img"
                aria-label="Compliance chart"
                data-testid="agg-compliance-chart"
              >
                <h4 className="admin-chart-panel__subtitle">Compliance chart</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={complianceBar}
                    margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#d0d0d0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#045339" radius={[2, 2, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {options.safetyIssues && (
              <div
                className="admin-chart"
                role="img"
                aria-label="Issues over time"
                data-testid="agg-issues-chart"
              >
                <h4 className="admin-chart-panel__subtitle">Issues over time</h4>
                {summary.issuesSeries.length === 0 ? (
                  <p className="admin-chart__empty">No issues in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={summary.issuesSeries}
                      margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#d0d0d0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="issues"
                        stroke="#9b2c2c"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Issues"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {options.safetyIssues && summary.notableIssues.length > 0 && (
        <section className="report-section">
          <h3 className="report-section__title report-section__title--accent">
            Notable issues
          </h3>
          <ul className="account-list" data-testid="agg-notable">
            {summary.notableIssues.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </section>
      )}

      {options.correctiveActions && summary.correctiveLines.length > 0 && (
        <section className="report-section">
          <h3 className="report-section__title report-section__title--accent">
            Corrective actions
          </h3>
          <ul className="account-list">
            {summary.correctiveLines.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </section>
      )}

      {options.photos && (
        <section className="report-section">
          <h3 className="report-section__title report-section__title--accent">Photos</h3>
          <p className="report-line">
            {summary.photoCount} photo(s) on checks in this period.
            {appendixPhotos.length > 0
              ? ` Showing ${appendixPhotos.length} in the Appendix.`
              : ''}
          </p>
        </section>
      )}

      {showAppendix && (
        <section className="report-section agg-appendix" data-testid="agg-appendix">
          <button
            type="button"
            className="agg-appendix__toggle"
            aria-expanded={appendixOpen}
            onClick={() => setAppendixOpen((open) => !open)}
          >
            <h3 className="report-section__title report-section__title--accent">
              Appendix
            </h3>
            <span className="agg-appendix__chevron" aria-hidden>
              {appendixOpen ? '▾' : '▸'}
            </span>
          </button>
          {appendixOpen && (
            <div className="agg-appendix__body">
              {options.safetyIssues && (
                <div className="agg-appendix__block">
                  <h4 className="agg-appendix__heading">
                    All safety issues ({appendixIssues.length})
                  </h4>
                  {appendixIssues.length === 0 ? (
                    <p className="report-line">No safety issues in this period.</p>
                  ) : (
                    <ul className="agg-appendix__issues" data-testid="agg-appendix-issues">
                      {appendixIssues.map((issue, idx) => (
                        <li
                          key={`${issue.date}-${issue.category}-${issue.summary}-${idx}`}
                          className="agg-appendix__issue"
                        >
                          <div className="agg-appendix__issue-meta">
                            <span>{issue.date || '—'}</span>
                            <span>{issue.workerName || '—'}</span>
                            <span className="agg-appendix__pill">{issue.category}</span>
                            {issue.severity ? (
                              <span className="agg-appendix__pill agg-appendix__pill--warn">
                                {issue.severity}
                              </span>
                            ) : null}
                            {issue.status ? (
                              <span className="agg-appendix__pill">{issue.status.replace('_', ' ')}</span>
                            ) : null}
                          </div>
                          <p className="agg-appendix__issue-summary">{issue.summary}</p>
                          {issue.immediateAction ? (
                            <p className="agg-appendix__issue-action">
                              Immediate action: {issue.immediateAction}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {options.photos && (
                <div className="agg-appendix__block">
                  <h4 className="agg-appendix__heading">
                    Photos ({resolvedPhotos.length || appendixPhotos.length}
                    {summary.photoCount > appendixPhotos.length
                      ? ` of ${summary.photoCount}`
                      : ''}
                    )
                  </h4>
                  {appendixPhotos.length === 0 ? (
                    <p className="report-line">No photos attached in this period.</p>
                  ) : (
                    <ul className="agg-appendix__photos" data-testid="agg-appendix-photos">
                      {resolvedPhotos.map((photo) => (
                        <li key={photo.id} className="agg-appendix__photo">
                          {photo.url ? (
                            <img
                              src={photo.url}
                              alt={`${photo.kind} photo — ${photo.workerName} ${photo.checkDate}`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="agg-appendix__photo-fallback">
                              Photo unavailable
                            </div>
                          )}
                          <p>
                            {photo.kind} · {photo.checkDate} · {photo.workerName}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </article>
  )
}
