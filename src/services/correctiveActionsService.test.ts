import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCorrectiveAction,
  markLinkedSubmissionUnderReview,
} from './correctiveActionsService'

const fromMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

type Chain = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

function chain(result: { data: unknown; error: { message: string } | null }): Chain {
  const c: Chain = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  }
  c.select.mockReturnValue(c)
  c.insert.mockReturnValue(c)
  c.update.mockReturnValue(c)
  c.eq.mockReturnValue(c)
  return c
}

describe('markLinkedSubmissionUnderReview', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('sets submitted → under_review with reviewed_by / reviewed_at', async () => {
    const issueChain = chain({
      data: { id: 'issue-1', submission_id: 'sub-1' },
      error: null,
    })
    const subSelectChain = chain({
      data: { id: 'sub-1', status: 'submitted' },
      error: null,
    })
    const updateChain = chain({ data: null, error: null })
    // update().eq() should resolve as a thenable without maybeSingle
    updateChain.eq.mockResolvedValue({ data: null, error: null })

    fromMock
      .mockReturnValueOnce(issueChain)
      .mockReturnValueOnce(subSelectChain)
      .mockReturnValueOnce(updateChain)

    const { error } = await markLinkedSubmissionUnderReview({
      safety_issue_id: 'issue-1',
      reviewerId: 'admin-1',
    })

    expect(error).toBeNull()
    expect(fromMock).toHaveBeenCalledWith('safety_issues')
    expect(fromMock).toHaveBeenCalledWith('submissions')
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'under_review',
        reviewed_by: 'admin-1',
        reviewed_at: expect.any(String),
      }),
    )
  })

  it('does not downgrade approved submissions', async () => {
    const issueChain = chain({
      data: { id: 'issue-1', submission_id: 'sub-1' },
      error: null,
    })
    const subSelectChain = chain({
      data: { id: 'sub-1', status: 'approved' },
      error: null,
    })

    fromMock.mockReturnValueOnce(issueChain).mockReturnValueOnce(subSelectChain)

    const { error } = await markLinkedSubmissionUnderReview({
      safety_issue_id: 'issue-1',
      reviewerId: 'admin-1',
    })

    expect(error).toBeNull()
    expect(fromMock).toHaveBeenCalledTimes(2)
  })

  it('keeps under_review without rewriting review stamps', async () => {
    const issueChain = chain({
      data: { id: 'issue-1', submission_id: 'sub-1' },
      error: null,
    })
    const subSelectChain = chain({
      data: { id: 'sub-1', status: 'under_review' },
      error: null,
    })

    fromMock.mockReturnValueOnce(issueChain).mockReturnValueOnce(subSelectChain)

    const { error } = await markLinkedSubmissionUnderReview({
      safety_issue_id: 'issue-1',
      reviewerId: 'admin-1',
    })

    expect(error).toBeNull()
    expect(fromMock).toHaveBeenCalledTimes(2)
  })
})

describe('createCorrectiveAction', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('creates CA then marks linked submission under_review', async () => {
    const caRow = {
      id: 'ca-1',
      safety_issue_id: 'issue-1',
      required_action: 'Fix guardrail',
      priority: 'high',
      status: 'open',
      assignee_id: null,
      due_date: null,
      resolution_notes: null,
      resolved_by: null,
      resolved_at: null,
      created_by: 'admin-1',
      created_at: '2026-10-03T12:00:00.000Z',
      updated_at: '2026-10-03T12:00:00.000Z',
    }

    const insertChain = chain({ data: caRow, error: null })
    const issueChain = chain({
      data: { id: 'issue-1', submission_id: 'sub-1' },
      error: null,
    })
    const subSelectChain = chain({
      data: { id: 'sub-1', status: 'submitted' },
      error: null,
    })
    const updateChain = chain({ data: null, error: null })
    updateChain.eq.mockResolvedValue({ data: null, error: null })

    fromMock
      .mockReturnValueOnce(insertChain) // corrective_actions insert
      .mockReturnValueOnce(issueChain)
      .mockReturnValueOnce(subSelectChain)
      .mockReturnValueOnce(updateChain)

    const { data, error } = await createCorrectiveAction({
      safety_issue_id: 'issue-1',
      required_action: 'Fix guardrail',
      priority: 'high',
      created_by: 'admin-1',
    })

    expect(error).toBeNull()
    expect(data?.id).toBe('ca-1')
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'under_review', reviewed_by: 'admin-1' }),
    )
  })
})
