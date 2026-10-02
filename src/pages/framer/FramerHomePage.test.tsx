import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth-context'
import { makeAuthValue, makeProfile } from '../../test/auth-test-utils'
import { FramerHomePage } from './FramerHomePage'

const listMySubmissions = vi.fn()

vi.mock('../../services/submissionsService', () => ({
  listMySubmissions: (...args: unknown[]) => listMySubmissions(...args),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

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
