import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App without Supabase env', () => {
  it('renders the public homepage shell', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    render(<App />)

    expect(screen.getByRole('heading', { level: 2, name: /SiteSafe/i })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent(/SITESAFE/i)
  })
})
