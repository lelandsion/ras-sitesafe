import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth-context'
import { makeAuthValue, makeProfile } from '../../test/auth-test-utils'
import { AdminWorkersPage } from './AdminWorkersPage'

const loadWorkerRoster = vi.fn()

vi.mock('../../services/workersService', () => ({
  loadWorkerRoster: (...args: unknown[]) => loadWorkerRoster(...args),
}))

describe('AdminWorkersPage', () => {
  beforeEach(() => {
    loadWorkerRoster.mockReset()
  })

  it('renders roster rows with Unassigned and submissions links', async () => {
    loadWorkerRoster.mockResolvedValue({
      dateISO: '2026-10-03',
      error: null,
      rows: [
        {
          framerId: 'f1',
          displayName: 'Alex Kim',
          siteNames: [],
          todayStatus: 'n_a',
        },
        {
          framerId: 'f2',
          displayName: 'Daniel Ortiz',
          siteNames: ['Harbor Deck'],
          todayStatus: 'missing',
        },
      ],
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
          <AdminWorkersPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Alex Kim')).toBeInTheDocument()
    })
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.getByText('Harbor Deck')).toBeInTheDocument()
    expect(screen.getByText('Missing')).toBeInTheDocument()
    expect(screen.getByText('N/A')).toBeInTheDocument()

    const submissionLinks = screen.getAllByRole('link', {
      name: /submissions/i,
    })
    expect(submissionLinks[0]).toHaveAttribute(
      'href',
      '/admin?worker=f1#submissions',
    )
    expect(submissionLinks[1]).toHaveAttribute(
      'href',
      '/admin?worker=f2#submissions',
    )
  })

  it('shows error state with retry', async () => {
    loadWorkerRoster.mockResolvedValue({
      rows: [],
      dateISO: '2026-10-03',
      error: 'Session expired. Sign in again.',
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
          <AdminWorkersPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await waitFor(() => {
      expect(
        screen.getByText('Session expired. Sign in again.'),
      ).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
