import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { AppHeader } from '../components/layout/AppHeader'
import { useAuth } from '../hooks/auth-context'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const envReady = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
  )

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: signInError } = await signIn(email.trim(), password)
    if (signInError) {
      setError(signInError)
      setSubmitting(false)
      return
    }

    // Resolve role for redirect
    const {
      data: { user },
    } = await supabase.auth.getUser()
    let dest = from ?? '/framer'
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role === 'admin') dest = from?.startsWith('/admin') ? from : '/admin'
      else if (profile?.role === 'framer') dest = from?.startsWith('/framer') ? from : '/framer'
    }

    navigate(dest, { replace: true })
    setSubmitting(false)
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="login" aria-labelledby="login-title">
          <p className="login__kicker">Ron Anderson &amp; Sons</p>
          <h2 id="login-title" className="login__title">
            Sign in
            <span>SiteSafe access</span>
          </h2>
          <p className="login__lead">
            Use your demo Admin or Framer account. Roles come from{' '}
            <code>profiles.role</code> after schema + seed.
          </p>

          {!envReady && (
            <p className="login__banner login__banner--warn" role="alert">
              Missing <code>VITE_SUPABASE_*</code> in <code>.env.local</code>. Copy{' '}
              <code>.env.example</code> and restart the dev server.
            </p>
          )}

          <form className="login__form" onSubmit={onSubmit} noValidate>
            <label className="login__field">
              <span>Email</span>
              <input
                className="login__input touch-target"
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ras-sitesafe-demo.com"
              />
            </label>
            <label className="login__field">
              <span>Password</span>
              <input
                className="login__input touch-target"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Demo password (after seed)"
              />
            </label>

            {error && (
              <p className="login__banner login__banner--error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn--primary touch-target login__submit"
              disabled={submitting || !envReady}
            >
              <LogIn size={20} strokeWidth={2.5} aria-hidden />
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="login__hint">
            Demo emails: <code>admin@ras-sitesafe-demo.com</code> ·{' '}
            <code>framer@ras-sitesafe-demo.com</code>
          </p>
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Internal construction safety tool
      </footer>
    </div>
  )
}
