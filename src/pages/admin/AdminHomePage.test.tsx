import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth-context'
import { makeAuthValue, makeProfile } from '../../test/auth-test-utils'
import { emptyDailySafetyChecklist } from '../../types/safetyChecklist'
import type { SubmissionWithDetails } from '../../types/database'
import { AdminHomePage } from './AdminHomePage'

const listAdminSubmissions = vi.fn()
const loadTodayComplianceOverview = vi.fn()

vi.mock('../../services/submissionsService', () => ({
  listAdminSubmissions: (...args: unknown[]) => listAdminSubmissions(...args),
  reviewSubmission: vi.fn(),
}))

vi.mock('../../services/complianceService', () => ({
  loadTodayComplianceOverview: (...args: unknown[]) =>
    loadTodayComplianceOverview(...args),
}))

vi.mock('../../services/photosService', () => ({
  listSubmissionPhotos: vi.fn().mockResolvedValue({ data: [], error: null }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('../../components/admin/SafetyReportCharts', () => ({
  IssuesByCategoryChart: () => null,
  SafetyTrendCharts: () => null,
}))

function makeSubmission(
  overrides: Partial<SubmissionWithDetails> = {},
): SubmissionWithDetails {
  const created = '2026-10-01T12:00:00Z'
  return {
    id: overrides.id ?? 'sub-1',
    site_id: overrides.site_id ?? 'site-1',
    submitted_by: overrides.submitted_by ?? 'framer-1',
    status: overrides.status ?? 'submitted',
    notes: overrides.notes ?? null,
    checklist:
      overrides.checklist ??
      (emptyDailySafetyChecklist('2026-10-01') as unknown as Record<
        string,
        unknown
      >),
    reviewed_by: overrides.reviewed_by ?? null,
    reviewed_at: overrides.reviewed_at ?? null,
    created_at: overrides.created_at ?? created,
    updated_at: overrides.updated_at ?? created,
    sites: overrides.sites ?? {
      id: 'site-1',
      name: 'Harbor Deck',
      address: '100 Pier',
    },
    submitter: overrides.submitter ?? {
      id: 'framer-1',
      display_name: 'Daniel Ortiz',
    },
  }
}

describe('AdminHomePage Worker Submissions navigation', () => {
  beforeEach(() => {
    listAdminSubmissions.mockReset()
    loadTodayComplianceOverview.mockReset()
    loadTodayComplianceOverview.mockResolvedValue({
      overall: { assigned: 0, submitted: 0, missing: 0, issues: 0 },
      sites: [],
      error: null,
    })
  })

  it('opens the form/review route, not preview, from row View / site link', async () => {
    listAdminSubmissions.mockResolvedValue({
      data: [makeSubmission({ id: 'sub-abc' })],
      error: null,
    })

    render(
      <AuthContext.Provider
        value={makeAuthValue({
          session: { access_token: 'tok' } as never,
          profile: makeProfile('admin'),
          role: 'admin',
          loading: false,
        })}
      >
        <MemoryRouter>
          <AdminHomePage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    const formHref = '/admin/submissions/sub-abc'

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Harbor Deck/i })).toHaveAttribute(
        'href',
        formHref,
      )
    })

    const siteLink = screen.getByRole('link', { name: /Harbor Deck/i })
    const viewLink = screen.getByRole('link', { name: /^View$/i })

    expect(siteLink).toHaveAttribute('href', formHref)
    expect(viewLink).toHaveAttribute('href', formHref)
    expect(siteLink.getAttribute('href')).not.toMatch(/\/preview$/)
    expect(viewLink.getAttribute('href')).not.toMatch(/\/preview$/)
  })
})
