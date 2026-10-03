import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  FileDown,
  FileWarning,
  FilterX,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { AdminNav } from '../../components/admin/AdminNav'
import {
  IssuesByCategoryChart,
  SafetyTrendCharts,
} from '../../components/admin/SafetyReportCharts'
import { AppHeader } from '../../components/layout/AppHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../hooks/auth-context'
import {
  aggregateSafetyMetrics,
  complianceOverTime,
  issuesByCategory,
  issuesOverTime,
  type ChecklistSubmissionRow,
} from '../../lib/checklistAnalytics'
import { exportSubmissionToPdf } from '../../lib/exportSubmissionPdf'
import {
  countActiveFilters,
  EMPTY_SUBMISSION_FILTERS,
  filterSubmissions,
  type SubmissionListFilters,
  uniqueSitesFromSubmissions,
  uniqueWorkersFromSubmissions,
} from '../../lib/filterSubmissions'
import { sortAdminSubmissions } from '../../lib/submissionAttention'
import { localDateISO } from '../../lib/dailyCompliance'
import {
  loadTodayComplianceOverview,
  type SiteComplianceOverview,
} from '../../services/complianceService'
import { listSubmissionPhotos } from '../../services/photosService'
import {
  listAdminSubmissions,
  reviewSubmission,
} from '../../services/submissionsService'
import type { ComplianceSummary } from '../../lib/dailyCompliance'
import type {
  SubmissionStatus,
  SubmissionWithDetails,
} from '../../types/database'
import {
  ADMIN_REVIEW_ACTION_LABELS,
  ADMIN_REVIEW_STATUSES,
  SUBMISSION_STATUS_LABELS,
} from '../../types/database'
import { CaAttentionBadge } from '../../components/ui/CaAttentionBadge'
import { countStructuredIssues } from '../../lib/checklistAnalytics'
import { parseDailySafetyChecklist } from '../../types/safetyChecklist'

function inReviewQueue(status: SubmissionStatus): boolean {
  return status === 'submitted' || status === 'under_review'
}

function toChecklistRows(items: SubmissionWithDetails[]): ChecklistSubmissionRow[] {
  return items.map((item) => ({
    id: item.id,
    status: item.status,
    checklist: item.checklist,
    created_at: item.created_at,
    updated_at: item.updated_at,
    siteName: item.sites?.name ?? 'Unknown site',
    workerName: item.submitter?.display_name ?? 'Unknown',
  }))
}

/** Drafts are framer-private — not an admin filter option. */
const STATUS_FILTER_OPTIONS: Array<SubmissionStatus | 'all'> = [
  'all',
  'submitted',
  'under_review',
  'approved',
  'rejected',
]

export function AdminHomePage() {
  const navigate = useNavigate()
  const { profile, user, signOut } = useAuth()
  const [items, setItems] = useState<SubmissionWithDetails[]>([])
  const [filters, setFilters] = useState<SubmissionListFilters>(
    EMPTY_SUBMISSION_FILTERS,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [todayOverall, setTodayOverall] = useState<ComplianceSummary>({
    assigned: 0,
    submitted: 0,
    missing: 0,
    issues: 0,
  })
  const [todaySites, setTodaySites] = useState<SiteComplianceOverview[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setActionError(null)
    const [{ data, error: listError }, compliance] = await Promise.all([
      listAdminSubmissions(),
      loadTodayComplianceOverview(localDateISO()),
    ])
    if (listError) {
      setError(listError)
      setItems([])
    } else {
      setItems(data)
    }
    if (!compliance.error) {
      setTodayOverall(compliance.overall)
      setTodaySites(compliance.sites)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredItems = useMemo(
    () => sortAdminSubmissions(filterSubmissions(items, filters)),
    [items, filters],
  )

  const siteOptions = useMemo(() => uniqueSitesFromSubmissions(items), [items])
  const workerOptions = useMemo(
    () => uniqueWorkersFromSubmissions(items),
    [items],
  )
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters])

  const checklistRows = useMemo(() => toChecklistRows(items), [items])

  const metrics = useMemo(
    () => aggregateSafetyMetrics(checklistRows),
    [checklistRows],
  )

  const categoryData = useMemo(
    () => issuesByCategory(checklistRows),
    [checklistRows],
  )

  const trendIssues = useMemo(
    () => issuesOverTime(checklistRows),
    [checklistRows],
  )

  const trendCompliance = useMemo(
    () => complianceOverTime(checklistRows),
    [checklistRows],
  )

  const reviewCounts = useMemo(() => {
    const queue = items.filter((i) => inReviewQueue(i.status)).length
    const approved = items.filter((i) => i.status === 'approved').length
    const rejected = items.filter((i) => i.status === 'rejected').length
    return { queue, approved, rejected, total: items.length }
  }, [items])

  const adminSummaryLines = useMemo(
    () => [
      `Avg checklist compliance: ${metrics.avgCompliance ?? '—'}%`,
      `Hazard reports: ${metrics.hazardReports}`,
      `Incidents / near misses: ${metrics.incidents}`,
      `Open structured issues: ${metrics.openIssueCount}`,
    ],
    [metrics],
  )

  async function onReview(
    submissionId: string,
    status: Extract<
      SubmissionStatus,
      'under_review' | 'approved' | 'rejected'
    >,
  ) {
    if (!user?.id) return
    setUpdatingId(submissionId)
    setActionError(null)
    const { data, error: reviewError } = await reviewSubmission(
      submissionId,
      status,
      user.id,
    )
    if (reviewError || !data) {
      setActionError(reviewError ?? 'Could not update status.')
      setUpdatingId(null)
      return
    }
    setItems((prev) =>
      prev.map((row) =>
        row.id === submissionId
          ? {
              ...row,
              status: data.status,
              reviewed_by: data.reviewed_by,
              reviewed_at: data.reviewed_at,
              updated_at: data.updated_at,
            }
          : row,
      ),
    )
    setUpdatingId(null)
  }

  async function exportRowPdf(item: SubmissionWithDetails) {
    const c = parseDailySafetyChecklist(item.checklist, item.created_at.slice(0, 10))
    const { data: photos } = await listSubmissionPhotos(item.id)
    await exportSubmissionToPdf({
      submission: item,
      photos,
      adminSummaryLines: [
        ...adminSummaryLines,
        `Structured issues on this check: ${countStructuredIssues(c)}`,
      ],
    })
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="admin-dash" aria-labelledby="admin-title">
          <div className="admin-dash__head">
            <div>
              <p className="admin-dash__kicker">Admin</p>
              <h2 id="admin-title" className="admin-dash__title">
                Site Safety Report
                <span>Compliance metrics from daily checks</span>
              </h2>
              <p className="admin-dash__lead">
                Signed in as{' '}
                <strong>{profile?.display_name ?? 'Admin'}</strong>. Review
                structured PPE, fall protection, hazards, and worker submissions.
              </p>
              <AdminNav />
            </div>
            <div className="admin-dash__actions">
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw size={20} strokeWidth={2.5} aria-hidden />
                Refresh
              </button>
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => void signOut()}
              >
                <LogOut size={20} strokeWidth={2.5} aria-hidden />
                Sign out
              </button>
            </div>
          </div>

          {loading && (
            <div className="panel-state" role="status">
              Loading site safety data…
            </div>
          )}

          {!loading && error && (
            <div className="panel-state panel-state--error" role="alert">
              <FileWarning size={28} strokeWidth={2.25} aria-hidden />
              <p>{error}</p>
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => void load()}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="admin-metrics" aria-label="Safety summary">
                <div className="admin-metrics__item admin-metrics__item--ok">
                  <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden />
                  <div>
                    <p className="admin-metrics__value">
                      {metrics.avgCompliance !== null
                        ? `${metrics.avgCompliance}%`
                        : '—'}
                    </p>
                    <p className="admin-metrics__label">Avg compliance</p>
                  </div>
                </div>
                <div className="admin-metrics__item admin-metrics__item--warn">
                  <AlertTriangle size={22} strokeWidth={2.25} aria-hidden />
                  <div>
                    <p className="admin-metrics__value">{metrics.hazardReports}</p>
                    <p className="admin-metrics__label">Hazard reports</p>
                  </div>
                </div>
                <div className="admin-metrics__item admin-metrics__item--danger">
                  <ShieldAlert size={22} strokeWidth={2.25} aria-hidden />
                  <div>
                    <p className="admin-metrics__value">{metrics.incidents}</p>
                    <p className="admin-metrics__label">Incidents / near miss</p>
                  </div>
                </div>
                <Link
                  to="/admin/issues"
                  className="admin-metrics__item admin-metrics__item--link"
                >
                  <ClipboardList size={22} strokeWidth={2.25} aria-hidden />
                  <div>
                    <p className="admin-metrics__value">{metrics.openIssueCount}</p>
                    <p className="admin-metrics__label">Open issues</p>
                  </div>
                </Link>
                <div className="admin-metrics__item">
                  <Users size={22} strokeWidth={2.25} aria-hidden />
                  <div>
                    <p className="admin-metrics__value">{metrics.submissions}</p>
                    <p className="admin-metrics__label">Checks submitted</p>
                  </div>
                </div>
              </div>

              <div
                className="today-compliance"
                aria-label="Today's compliance"
              >
                <div className="today-compliance__head">
                  <h3 className="today-compliance__title">
                    Today&apos;s compliance
                  </h3>
                  <p className="today-compliance__overall">
                    {todayOverall.submitted}/{todayOverall.assigned} submitted
                    {todayOverall.missing > 0
                      ? ` · ${todayOverall.missing} missing`
                      : ''}
                  </p>
                </div>
                {todaySites.length === 0 ? (
                  <p className="admin-panel__empty">
                    No active site assignments for today.
                  </p>
                ) : (
                  <ul className="today-compliance__list">
                    {todaySites.map((site) => (
                      <li key={site.siteId} className="today-compliance__row">
                        <div className="today-compliance__copy">
                          <p className="today-compliance__site">
                            {site.siteName}
                          </p>
                          <p className="today-compliance__meta">
                            {site.summary.submitted}/{site.summary.assigned}{' '}
                            submitted
                            {site.summary.issues > 0
                              ? ` · ${site.summary.issues} with issues`
                              : ''}
                          </p>
                        </div>
                        {site.summary.missing > 0 ? (
                          <Link
                            to={`/admin/sites/${site.siteId}/compliance?filter=missing&date=${localDateISO()}`}
                            className="today-compliance__missing touch-target"
                          >
                            <span className="today-compliance__link-text">
                              Missing {site.summary.missing}
                            </span>
                            <ChevronRight
                              size={18}
                              strokeWidth={2.5}
                              aria-hidden
                              className="today-compliance__chevron"
                            />
                          </Link>
                        ) : (
                          <Link
                            to={`/admin/sites/${site.siteId}/compliance?date=${localDateISO()}`}
                            className="today-compliance__ok touch-target"
                          >
                            <span className="today-compliance__link-text">
                              View
                            </span>
                            <ChevronRight
                              size={18}
                              strokeWidth={2.5}
                              aria-hidden
                              className="today-compliance__chevron"
                            />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="admin-report-grid">
                <div className="admin-chart-panel">
                  <h3 className="admin-chart-panel__title">Issues by category</h3>
                  <p className="admin-chart-panel__lead">
                    Count of “No” answers, hazards, and incidents across non-draft
                    checks.
                  </p>
                  <IssuesByCategoryChart data={categoryData} />
                </div>
                <div className="admin-chart-panel admin-chart-panel--wide">
                  <h3 className="admin-chart-panel__title">Trends</h3>
                  <p className="admin-chart-panel__lead">
                    Issues logged per check date and average Yes-rate on scored
                    items.
                  </p>
                  <SafetyTrendCharts
                    issues={trendIssues}
                    compliance={trendCompliance}
                  />
                </div>
              </div>

              <div className="admin-panel admin-panel--compact">
                <Link
                  to="/admin/issues"
                  className="admin-issues-summary touch-target"
                >
                  <div className="admin-issues-summary__copy">
                    <h3 className="admin-panel__title">Open issues</h3>
                    <p className="admin-issues-summary__lead">
                      {metrics.openIssueCount === 0
                        ? 'No open structured issues. Create and resolve corrective actions on Safety Issues.'
                        : 'Full list and corrective actions live on Safety Issues.'}
                    </p>
                  </div>
                  <span className="admin-issues-summary__cta">
                    <span className="admin-issues-summary__count">
                      {metrics.openIssueCount} open
                      {metrics.openIssueCount === 1 ? ' issue' : ' issues'}
                    </span>
                    <ChevronRight
                      size={20}
                      strokeWidth={2.5}
                      aria-hidden
                      className="admin-issues-summary__chevron"
                    />
                  </span>
                </Link>
              </div>

              {actionError && (
                <p className="form-banner form-banner--error" role="alert">
                  {actionError}
                </p>
              )}

              <div className="admin-panel">
                <h3 className="admin-panel__title">Worker submissions</h3>
                <p className="admin-panel__lead">
                  Review queue: {reviewCounts.queue} · Reviewed:{' '}
                  {reviewCounts.approved} · Rejected: {reviewCounts.rejected}
                </p>

                <form
                  className="submission-filters"
                  aria-label="Filter submissions"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <div className="submission-filters__grid">
                    <label className="submission-filters__field">
                      <span>Site</span>
                      <select
                        className="safety-form__control touch-target"
                        value={filters.siteId}
                        onChange={(e) =>
                          setFilters((f) => ({ ...f, siteId: e.target.value }))
                        }
                      >
                        <option value="">All sites</option>
                        {siteOptions.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="submission-filters__field">
                      <span>Worker</span>
                      <select
                        className="safety-form__control touch-target"
                        value={filters.workerId}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            workerId: e.target.value,
                          }))
                        }
                      >
                        <option value="">All workers</option>
                        {workerOptions.map((worker) => (
                          <option key={worker.id} value={worker.id}>
                            {worker.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="submission-filters__field">
                      <span>From date</span>
                      <input
                        type="date"
                        className="safety-form__control touch-target"
                        value={filters.dateFrom}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            dateFrom: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="submission-filters__field">
                      <span>To date</span>
                      <input
                        type="date"
                        className="safety-form__control touch-target"
                        value={filters.dateTo}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            dateTo: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="submission-filters__field">
                      <span>Issues</span>
                      <select
                        className="safety-form__control touch-target"
                        value={filters.issues}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            issues: e.target.value as SubmissionListFilters['issues'],
                          }))
                        }
                      >
                        <option value="all">All</option>
                        <option value="has_issues">Has open issues</option>
                        <option value="no_issues">No issues</option>
                      </select>
                    </label>
                    <label className="submission-filters__field">
                      <span>Status</span>
                      <select
                        className="safety-form__control touch-target"
                        value={filters.status}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            status: e.target.value as SubmissionListFilters['status'],
                          }))
                        }
                      >
                        {STATUS_FILTER_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status === 'all'
                              ? 'All statuses'
                              : SUBMISSION_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="submission-filters__bar">
                    <p className="submission-filters__count">
                      Showing {filteredItems.length} of {items.length}
                      {activeFilterCount > 0
                        ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} on`
                        : ''}
                    </p>
                    <button
                      type="button"
                      className="btn btn--ghost touch-target"
                      disabled={activeFilterCount === 0}
                      onClick={() => setFilters(EMPTY_SUBMISSION_FILTERS)}
                    >
                      <FilterX size={18} strokeWidth={2.5} aria-hidden />
                      Clear filters
                    </button>
                  </div>
                </form>

                {items.length === 0 ? (
                  <p className="admin-panel__empty">
                    No daily safety checks yet. Framers submit from the field.
                  </p>
                ) : filteredItems.length === 0 ? (
                  <div
                    className="admin-panel__empty admin-panel__empty--filtered"
                    role="status"
                  >
                    <p>No submissions match these filters.</p>
                    <button
                      type="button"
                      className="btn btn--ghost touch-target"
                      onClick={() => setFilters(EMPTY_SUBMISSION_FILTERS)}
                    >
                      <FilterX size={18} strokeWidth={2.5} aria-hidden />
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th scope="col">Site</th>
                          <th scope="col">Worker</th>
                          <th scope="col">Check date</th>
                          <th scope="col">Issues</th>
                          <th scope="col">Status</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((item) => {
                          const c = parseDailySafetyChecklist(
                            item.checklist,
                            item.created_at.slice(0, 10),
                          )
                          const issueCount = countStructuredIssues(c)
                          const busy = updatingId === item.id
                          // Open form/review first (Framer flow); Preview is on the form.
                          const detailPath = `/admin/submissions/${item.id}`
                          return (
                            <tr
                              key={item.id}
                              className="admin-table__row--clickable"
                              onClick={(e) => {
                                const target = e.target as HTMLElement
                                if (
                                  target.closest(
                                    'a, button, select, textarea, input, label',
                                  )
                                ) {
                                  return
                                }
                                void navigate(detailPath)
                              }}
                            >
                              <td>
                                <Link
                                  to={detailPath}
                                  className="admin-table__site-link"
                                >
                                  <strong>{item.sites?.name ?? '—'}</strong>
                                </Link>
                                {item.notes?.trim() && (
                                  <p className="admin-table__note">{item.notes}</p>
                                )}
                              </td>
                              <td>{item.submitter?.display_name ?? '—'}</td>
                              <td>{c.checkDate || '—'}</td>
                              <td>{issueCount}</td>
                              <td>
                                <div className="admin-table__status-stack">
                                  <StatusBadge status={item.status} />
                                  <CaAttentionBadge
                                    attention={item.caAttention}
                                  />
                                </div>
                              </td>
                              <td>
                                <div className="admin-table__actions">
                                  <select
                                    className="admin-row__select touch-target"
                                    defaultValue=""
                                    key={`${item.id}-${item.status}`}
                                    disabled={busy}
                                    aria-label={`Review ${item.sites?.name ?? 'submission'}`}
                                    onChange={(e) => {
                                      const next = e.target.value
                                      if (
                                        next !== 'under_review' &&
                                        next !== 'approved' &&
                                        next !== 'rejected'
                                      ) {
                                        return
                                      }
                                      void onReview(
                                        item.id,
                                        next as typeof next & SubmissionStatus,
                                      )
                                    }}
                                  >
                                    <option value="" disabled>
                                      Review…
                                    </option>
                                    {ADMIN_REVIEW_STATUSES.map((s) => (
                                      <option
                                        key={s}
                                        value={s}
                                        disabled={s === item.status}
                                      >
                                        {ADMIN_REVIEW_ACTION_LABELS[s]}
                                      </option>
                                    ))}
                                  </select>
                                  <Link
                                    to={detailPath}
                                    className="btn btn--ghost touch-target admin-table__pdf"
                                  >
                                    <Eye size={18} strokeWidth={2.5} aria-hidden />
                                    View
                                  </Link>
                                  <button
                                    type="button"
                                    className="btn btn--ghost touch-target admin-table__pdf"
                                    onClick={() => void exportRowPdf(item)}
                                  >
                                    <FileDown size={18} strokeWidth={2.5} aria-hidden />
                                    Export PDF
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Site Safety Report
      </footer>
    </div>
  )
}
