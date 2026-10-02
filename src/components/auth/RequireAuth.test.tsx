import { render, screen } from '@testing-library/react'
import { Route } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RedirectIfAuthed, RequireAuth } from './RequireAuth'
import { AuthRoutes, makeProfile } from '../../test/auth-test-utils'

describe('RequireAuth', () => {
  it('shows config notice when Supabase env is missing', () => {
    render(
      <AuthRoutes
        auth={{ loading: false, supabaseConfigured: false }}
        initialPath="/admin/panel"
      >
        <Route element={<RequireAuth role="admin" />}>
          <Route path="/admin/panel" element={<div>Admin secret</div>} />
        </Route>
      </AuthRoutes>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/Sign-in unavailable/i)
    expect(screen.getByRole('alert')).not.toHaveTextContent(/SQL|migration|\.env/i)
    expect(screen.queryByText('Admin secret')).not.toBeInTheDocument()
  })

  it('shows a loading state while auth is resolving', () => {
    render(
      <AuthRoutes auth={{ loading: true }} initialPath="/admin/panel">
        <Route element={<RequireAuth role="admin" />}>
          <Route path="/admin/panel" element={<div>Admin secret</div>} />
        </Route>
      </AuthRoutes>,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Checking session/i)
    expect(screen.queryByText('Admin secret')).not.toBeInTheDocument()
  })

  it('redirects anonymous users to /login', () => {
    render(
      <AuthRoutes auth={{ loading: false, session: null }} initialPath="/admin/panel">
        <Route element={<RequireAuth role="admin" />}>
          <Route path="/admin/panel" element={<div>Admin secret</div>} />
        </Route>
      </AuthRoutes>,
    )
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Admin secret')).not.toBeInTheDocument()
  })

  it('shows a profile missing alert when session exists without profile', () => {
    const signOut = vi.fn(async () => undefined)
    render(
      <AuthRoutes
        auth={{
          loading: false,
          session: { access_token: 'tok' } as never,
          profile: null,
          role: null,
          signOut,
        }}
        initialPath="/framer/panel"
      >
        <Route element={<RequireAuth role="framer" />}>
          <Route path="/framer/panel" element={<div>Framer secret</div>} />
        </Route>
      </AuthRoutes>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      /not set up for SiteSafe|Ask an admin/i,
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent(/SQL|migration|seed/i)
    expect(screen.queryByText('Framer secret')).not.toBeInTheDocument()
  })

  it('redirects framer away from admin-only routes', () => {
    const profile = makeProfile('framer')
    render(
      <AuthRoutes
        auth={{
          loading: false,
          session: { access_token: 'tok' } as never,
          profile,
          role: 'framer',
        }}
        initialPath="/admin/panel"
      >
        <Route element={<RequireAuth role="admin" />}>
          <Route path="/admin/panel" element={<div>Admin secret</div>} />
        </Route>
      </AuthRoutes>,
    )
    expect(screen.getByText('Framer home')).toBeInTheDocument()
    expect(screen.queryByText('Admin secret')).not.toBeInTheDocument()
  })

  it('redirects admin away from framer-only routes', () => {
    const profile = makeProfile('admin')
    render(
      <AuthRoutes
        auth={{
          loading: false,
          session: { access_token: 'tok' } as never,
          profile,
          role: 'admin',
        }}
        initialPath="/framer/panel"
      >
        <Route element={<RequireAuth role="framer" />}>
          <Route path="/framer/panel" element={<div>Framer secret</div>} />
        </Route>
      </AuthRoutes>,
    )
    expect(screen.getByText('Admin home')).toBeInTheDocument()
    expect(screen.queryByText('Framer secret')).not.toBeInTheDocument()
  })

  it('renders the outlet when role matches', () => {
    const profile = makeProfile('admin')
    render(
      <AuthRoutes
        auth={{
          loading: false,
          session: { access_token: 'tok' } as never,
          profile,
          role: 'admin',
        }}
        initialPath="/admin/panel"
      >
        <Route element={<RequireAuth role="admin" />}>
          <Route path="/admin/panel" element={<div>Admin secret</div>} />
        </Route>
      </AuthRoutes>,
    )
    expect(screen.getByText('Admin secret')).toBeInTheDocument()
  })
})

describe('RedirectIfAuthed', () => {
  it('sends signed-in admins to /admin', () => {
    const profile = makeProfile('admin')
    render(
      <AuthRoutes
        auth={{
          loading: false,
          session: { access_token: 'tok' } as never,
          profile,
          role: 'admin',
        }}
        initialPath="/login"
      >
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<div>Login form</div>} />
        </Route>
      </AuthRoutes>,
    )
    expect(screen.getByText('Admin home')).toBeInTheDocument()
    expect(screen.queryByText('Login form')).not.toBeInTheDocument()
  })

  it('sends signed-in framers to /framer', () => {
    const profile = makeProfile('framer')
    render(
      <AuthRoutes
        auth={{
          loading: false,
          session: { access_token: 'tok' } as never,
          profile,
          role: 'framer',
        }}
        initialPath="/login"
      >
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<div>Login form</div>} />
        </Route>
      </AuthRoutes>,
    )
    expect(screen.getByText('Framer home')).toBeInTheDocument()
  })

  it('leaves anonymous users on the login outlet', () => {
    render(
      <AuthRoutes auth={{ loading: false, session: null }} initialPath="/login">
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<div>Login form</div>} />
        </Route>
      </AuthRoutes>,
    )
    expect(screen.getByText('Login form')).toBeInTheDocument()
  })
})
