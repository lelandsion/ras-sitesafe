import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../hooks/auth-context'
import { makeAuthValue } from '../test/auth-test-utils'
import { HomePage } from './HomePage'

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))

describe('HomePage', () => {
  it('shows RAS SiteSafe brand signals and primary CTAs', () => {
    render(
      <AuthContext.Provider value={makeAuthValue()}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(screen.getByRole('banner')).toHaveTextContent(/RAS[\s\S]*SITESAFE/i)
    expect(screen.getByRole('heading', { level: 2, name: /SiteSafe/i })).toBeInTheDocument()

    const signInLinks = screen.getAllByRole('link', { name: /^Sign in$/i })
    expect(signInLinks.length).toBeGreaterThanOrEqual(1)
    expect(signInLinks.every((el) => el.getAttribute('href') === '/login')).toBe(
      true,
    )

    expect(screen.getByRole('link', { name: /^How it works$/i })).toHaveAttribute(
      'href',
      '#how-it-works',
    )
    expect(document.getElementById('how-it-works')).toBeTruthy()

    const main = screen.getByRole('main')
    expect(main).toHaveTextContent(/Daily Safety Check/i)
    expect(main).toHaveTextContent(/File a daily check/i)
    expect(main).toHaveTextContent(/Review and report/i)
    expect(main).not.toHaveTextContent(/SQL|Parts?\s*1|migration|seed|\.env|ras_jobsites/i)
  })
})
