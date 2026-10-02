import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth-context'
import { makeAuthValue, makeProfile } from '../../test/auth-test-utils'
import { AdminSitesPage } from './AdminSitesPage'

const listAdminSites = vi.fn()

vi.mock('../../services/sitesService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/sitesService')>()
  return {
    ...actual,
    listAdminSites: (...args: unknown[]) => listAdminSites(...args),
    createSite: vi.fn(),
    updateSite: vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

describe('AdminSitesPage empty state', () => {
  beforeEach(() => {
    listAdminSites.mockReset()
  })

  it('prompts admins to create a site without seed SQL copy', async () => {
    listAdminSites.mockResolvedValue({ data: [], error: null })
    const profile = makeProfile('admin')

    render(
      <AuthContext.Provider
        value={makeAuthValue({
          session: { access_token: 'tok' } as never,
          profile,
          role: 'admin',
          loading: false,
        })}
      >
        <MemoryRouter>
          <AdminSitesPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await waitFor(() => {
      expect(screen.getByText(/No jobsites yet/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Create a site to assign framers/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add first site/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).not.toHaveTextContent(
      /SQL|seed|ras_jobsites|migration/i,
    )
  })
})
