import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SafetyIssueWithDetails } from '../../types/correctiveActions'
import { SubmissionIssuesPanel } from './SubmissionIssuesPanel'

const markCorrectiveActionReadyForReview = vi.fn()

vi.mock('../../services/correctiveActionsService', () => ({
  markCorrectiveActionReadyForReview: (...args: unknown[]) =>
    markCorrectiveActionReadyForReview(...args),
}))

function issueWithCa(
  status: SafetyIssueWithDetails['corrective_action'] extends infer C
    ? C extends { status: infer S }
      ? S
      : never
    : never,
): SafetyIssueWithDetails {
  return {
    id: 'issue-1',
    submission_id: 'sub-1',
    checklist_item_key: 'ppe.hardHat',
    item_label: 'Hard hat',
    description: 'Missing hard hat',
    severity: 'high',
    immediate_action: 'Stop work',
    created_by: 'framer-1',
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    submission: null,
    corrective_action: {
      id: 'ca-1',
      safety_issue_id: 'issue-1',
      required_action: 'Install hard hat station',
      priority: 'high',
      status,
      assignee_id: null,
      due_date: null,
      resolution_notes: null,
      resolved_by: null,
      resolved_at: null,
      framer_completed_at:
        status === 'ready_for_review' ? '2026-10-03T14:00:00Z' : null,
      framer_completion_notes:
        status === 'ready_for_review' ? 'Station installed' : null,
      created_by: 'admin-1',
      created_at: '2026-10-02T12:00:00Z',
      updated_at: '2026-10-03T14:00:00Z',
    },
  }
}

describe('SubmissionIssuesPanel mark complete', () => {
  beforeEach(() => {
    markCorrectiveActionReadyForReview.mockReset()
  })

  it('shows mark-complete control for open CA when allowed', () => {
    render(
      <SubmissionIssuesPanel
        issues={[issueWithCa('open')]}
        allowMarkComplete
      />,
    )
    expect(screen.getByTestId('ca-mark-complete-ca-1')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Mark completed \/ Ready for review/i,
      }),
    ).toBeInTheDocument()
  })

  it('hides mark-complete when not allowed (admin view)', () => {
    render(
      <SubmissionIssuesPanel
        issues={[issueWithCa('open')]}
        allowMarkComplete={false}
      />,
    )
    expect(screen.queryByTestId('ca-mark-complete-ca-1')).not.toBeInTheDocument()
  })

  it('shows awaiting admin review after framer mark', () => {
    render(
      <SubmissionIssuesPanel
        issues={[issueWithCa('ready_for_review')]}
        allowMarkComplete
      />,
    )
    expect(screen.getByTestId('ca-awaiting-review-ca-1')).toBeInTheDocument()
    expect(screen.getByText(/Ready for review/i)).toBeInTheDocument()
    expect(screen.queryByTestId('ca-mark-complete-ca-1')).not.toBeInTheDocument()
  })

  it('calls markCorrectiveActionReadyForReview with optional note', async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    markCorrectiveActionReadyForReview.mockResolvedValue({
      data: { id: 'ca-1', status: 'ready_for_review' },
      error: null,
    })

    render(
      <SubmissionIssuesPanel
        issues={[issueWithCa('in_progress')]}
        allowMarkComplete
        onChanged={onChanged}
      />,
    )

    await user.type(
      screen.getByPlaceholderText(/What did you do/i),
      'Guardrail fixed',
    )
    await user.click(
      screen.getByRole('button', {
        name: /Mark completed \/ Ready for review/i,
      }),
    )

    await waitFor(() => {
      expect(markCorrectiveActionReadyForReview).toHaveBeenCalledWith({
        id: 'ca-1',
        completion_notes: 'Guardrail fixed',
      })
    })
    expect(onChanged).toHaveBeenCalled()
  })
})
