import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth-context'
import { makeAuthValue, makeProfile } from '../../test/auth-test-utils'
import type { SubmissionWithSite } from '../../types/database'
import { FramerHomePage } from './FramerHomePage'

const listMySubmissions = vi.fn()

vi.mock('../../services/submissionsService', () => ({
  listMySubmissions: (...args: unknown[]) => listMySubmissions(...args),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

function submission(
  overrides: Partial<SubmissionWithSite> & { id: string },
): SubmissionWithSite {
  return {
    site_id: 'site-1',
    submitted_by: 'framer-1',
    status: 'submitted',
    checklist: {},
    notes: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-10-01T12:00:00.000Z',
    updated_at: '2026-10-01T12:00:00.000Z',
    sites: { id: 'site-1', name: 'Harbor Deck', address: null },
    caAttention: null,
    ...overrides,
  }
}

describe('FramerHomePage empty state', () => {
  beforeEach(() => {
    listMySubmissions.mockReset()
  })

  it('tells framers to start a report (no SQL / seed instructions)', async () => {
    listMySubmissions.mockResolvedValue({ data: [], error: null })
    const profile = makeProfile('framer')

    render(
      <AuthContext.Provider
        value={makeAuthValue({
          session: { access_token: 'tok' } as never,
          profile,
          role: 'framer',
          loading: false,
        })}
      >
        <MemoryRouter>
          <FramerHomePage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await waitFor(() => {
      expect(screen.getByText(/No safety reports yet/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /Start first report/i })).toHaveAttribute(
      'href',
      '/framer/new',
    )
    expect(screen.getByRole('main')).not.toHaveTextContent(
      /SQL|migration|seed|ras_jobsites|\.env/i,
    )
  })
})

describe('FramerHomePage list sort and CA badges', () => {
  beforeEach(() => {
    listMySubmissions.mockReset()
  })

  it('sorts Reviewed (approved) below submitted/under_review and shows CA badges', async () => {
    listMySubmissions.mockResolvedValue({
      data: [
        submission({
          id: 'reviewed',
          status: 'approved',
          updated_at: '2026-10-03T20:00:00.000Z',
          sites: { id: 'site-1', name: 'Reviewed Site', address: null },
        }),
        submission({
          id: 'with-ca',
          status: 'submitted',
          updated_at: '2026-10-02T12:00:00.000Z',
          sites: { id: 'site-2', name: 'CA Site', address: null },
          caAttention: 'open',
        }),
        submission({
          id: 'ready-ca',
          status: 'under_review',
          updated_at: '2026-10-03T10:00:00.000Z',
          sites: { id: 'site-3', name: 'Ready Site', address: null },
          caAttention: 'ready_for_review',
        }),
      ],
      error: null,
    })

    render(
      <AuthContext.Provider
        value={makeAuthValue({
          session: { access_token: 'tok' } as never,
          profile: makeProfile('framer'),
          role: 'framer',
          loading: false,
        })}
      >
        <MemoryRouter>
          <FramerHomePage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    const list = await screen.findByRole('list', { name: /Your submissions/i })
    const cards = within(list).getAllByRole('link')
    expect(cards.map((c) => c.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Ready Site'),
        expect.stringContaining('CA Site'),
        expect.stringContaining('Reviewed Site'),
      ]),
    )
    expect(cards[0]).toHaveTextContent('Ready Site')
    expect(cards[1]).toHaveTextContent('CA Site')
    expect(cards[2]).toHaveTextContent('Reviewed Site')

    expect(screen.getByText('Reviewed')).toBeInTheDocument()
    expect(screen.queryByText('Approved')).not.toBeInTheDocument()
    expect(screen.getByTestId('ca-attention-open')).toHaveTextContent(
      'Corrective action',
    )
    expect(screen.getByTestId('ca-attention-ready_for_review')).toHaveTextContent(
      'CA ready for review',
    )
  })
})
