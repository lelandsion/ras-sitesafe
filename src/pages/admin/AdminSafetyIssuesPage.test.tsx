import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth-context'
import { makeAuthValue, makeProfile } from '../../test/auth-test-utils'
import type { SafetyIssueWithDetails } from '../../types/correctiveActions'
import { AdminSafetyIssuesPage } from './AdminSafetyIssuesPage'

const listAdminSafetyIssues = vi.fn()

vi.mock('../../services/safetyIssuesService', () => ({
  listAdminSafetyIssues: (...args: unknown[]) => listAdminSafetyIssues(...args),
}))

vi.mock('../../services/correctiveActionsService', () => ({
  createCorrectiveAction: vi.fn(),
  resolveCorrectiveAction: vi.fn(),
  setCorrectiveActionStatus: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

describe('AdminSafetyIssuesPage submission links', () => {
  beforeEach(() => {
    listAdminSafetyIssues.mockReset()
  })

  it('links View submission to the form route, not preview', async () => {
    const issue: SafetyIssueWithDetails = {
      id: 'issue-1',
      submission_id: 'sub-xyz',
      checklist_item_key: 'ppe.hardHat',
      item_label: 'Hard hat',
      description: 'Worker without hard hat',
      severity: 'high',
      immediate_action: 'Stop work',
      created_by: 'framer-1',
      created_at: '2026-10-01T12:00:00Z',
      updated_at: '2026-10-01T12:00:00Z',
      submission: {
        id: 'sub-xyz',
        site_id: 'site-1',
        submitted_by: 'framer-1',
        status: 'submitted',
        created_at: '2026-10-01T12:00:00Z',
        sites: { id: 'site-1', name: 'Harbor Deck' },
        submitter: { id: 'framer-1', display_name: 'Daniel Ortiz' },
      },
      corrective_action: null,
    }

    listAdminSafetyIssues.mockResolvedValue({ data: [issue], error: null })

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
          <AdminSafetyIssuesPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: /View submission/i }),
      ).toBeInTheDocument()
    })

    const link = screen.getByRole('link', { name: /View submission/i })
    expect(link).toHaveAttribute('href', '/admin/submissions/sub-xyz')
    expect(link.getAttribute('href')).not.toMatch(/\/preview$/)
  })
})
