import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

function baseIssue(
  overrides: Partial<SafetyIssueWithDetails> & {
    id: string
    corrective_action: SafetyIssueWithDetails['corrective_action']
  },
): SafetyIssueWithDetails {
  return {
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
    ...overrides,
  }
}

describe('AdminSafetyIssuesPage submission links', () => {
  beforeEach(() => {
    listAdminSafetyIssues.mockReset()
  })

  it('links View submission to the form route, not preview', async () => {
    const issue = baseIssue({ id: 'issue-1', corrective_action: null })

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

  it('shows Ready for review badge and filter', async () => {
    const user = userEvent.setup()
    const ready = baseIssue({
      id: 'issue-ready',
      item_label: 'Guardrail gap',
      created_at: '2026-10-02T12:00:00Z',
      corrective_action: {
        id: 'ca-ready',
        safety_issue_id: 'issue-ready',
        required_action: 'Close gap',
        priority: 'high',
        status: 'ready_for_review',
        assignee_id: null,
        due_date: null,
        resolution_notes: null,
        resolved_by: null,
        resolved_at: null,
        framer_completed_at: '2026-10-03T14:00:00Z',
        framer_completion_notes: 'Gap closed with chain',
        created_by: 'admin-1',
        created_at: '2026-10-02T13:00:00Z',
        updated_at: '2026-10-03T14:00:00Z',
      },
    })
    const open = baseIssue({
      id: 'issue-open',
      item_label: 'Open harness issue',
      created_at: '2026-10-01T12:00:00Z',
      corrective_action: {
        id: 'ca-open',
        safety_issue_id: 'issue-open',
        required_action: 'Inspect harness',
        priority: 'medium',
        status: 'open',
        assignee_id: null,
        due_date: null,
        resolution_notes: null,
        resolved_by: null,
        resolved_at: null,
        framer_completed_at: null,
        framer_completion_notes: null,
        created_by: 'admin-1',
        created_at: '2026-10-01T13:00:00Z',
        updated_at: '2026-10-01T13:00:00Z',
      },
    })

    listAdminSafetyIssues.mockResolvedValue({
      data: [open, ready],
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
          <AdminSafetyIssuesPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('ca-ready-badge-ca-ready')).toBeInTheDocument()
    })
    expect(screen.getByText(/Gap closed with chain/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Ready for review \(1\)/i }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Ready for review \(1\)/i }),
    )

    expect(screen.getByText('Guardrail gap')).toBeInTheDocument()
    expect(screen.queryByText('Open harness issue')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Send back \(in progress\)/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Resolve$/i })).toBeInTheDocument()
  })
})
