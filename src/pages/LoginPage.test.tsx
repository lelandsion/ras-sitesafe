import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../hooks/auth-context'
import { LoginPage } from './LoginPage'

const getUser = vi.fn()
const maybeSingle = vi.fn()

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUser(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: (...args: unknown[]) => maybeSingle(...args),
        }),
      }),
    }),
  }),
}))

function renderLogin(authOverrides: Partial<AuthContextValue> = {}) {
  const signIn =
    authOverrides.signIn ??
    vi.fn(async () => ({ error: null as string | null }))
  const value: AuthContextValue = {
    session: null,
    user: null,
    profile: null,
    role: null,
    loading: false,
    supabaseConfigured: true,
    signOut: async () => undefined,
    ...authOverrides,
    signIn,
  }

  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<div>Admin landed</div>} />
          <Route path="/framer" element={<div>Framer landed</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )

  return { signIn }
}

describe('LoginPage', () => {
  beforeEach(() => {
    getUser.mockReset()
    maybeSingle.mockReset()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
  })

  it('shows example placeholders (not demo emails)', () => {
    renderLogin()
    expect(screen.getByLabelText(/^Email$/i)).toHaveAttribute(
      'placeholder',
      'you@example.com',
    )
    expect(screen.getByLabelText(/^Password$/i)).toHaveAttribute(
      'placeholder',
      '••••••••',
    )
    expect(screen.queryByPlaceholderText(/ras-sitesafe-demo/i)).not.toBeInTheDocument()
  })

  it('requires email and password via native constraints', () => {
    renderLogin()
    expect(screen.getByLabelText(/^Email$/i)).toBeRequired()
    expect(screen.getByLabelText(/^Password$/i)).toBeRequired()
  })

  it('surfaces sign-in errors from auth', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn(async () => ({ error: 'Invalid login credentials' }))
    renderLogin({ signIn })

    await user.type(screen.getByLabelText(/^Email$/i), 'admin@ras-sitesafe-demo.com')
    await user.type(screen.getByLabelText(/^Password$/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /Sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Invalid login credentials/i,
    )
    expect(signIn).toHaveBeenCalledWith(
      'admin@ras-sitesafe-demo.com',
      'wrong-password',
    )
  })

  it('redirects admins to /admin after a successful sign-in', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn(async () => ({ error: null }))
    getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    maybeSingle.mockResolvedValue({ data: { role: 'admin' } })
    renderLogin({ signIn })

    await user.type(screen.getByLabelText(/^Email$/i), 'admin@ras-sitesafe-demo.com')
    await user.type(screen.getByLabelText(/^Password$/i), 'demo-password')
    await user.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Admin landed')).toBeInTheDocument()
    })
  })

  it('redirects framers to /framer after a successful sign-in', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn(async () => ({ error: null }))
    getUser.mockResolvedValue({ data: { user: { id: 'framer-1' } } })
    maybeSingle.mockResolvedValue({ data: { role: 'framer' } })
    renderLogin({ signIn })

    await user.type(screen.getByLabelText(/^Email$/i), 'framer@ras-sitesafe-demo.com')
    await user.type(screen.getByLabelText(/^Password$/i), 'demo-password')
    await user.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Framer landed')).toBeInTheDocument()
    })
  })
})
