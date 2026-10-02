import { afterEach, describe, expect, it, vi } from 'vitest'

describe('supabase env guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('does not throw on import when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    await expect(import('./supabase')).resolves.toMatchObject({
      isSupabaseConfigured: false,
    })
  })

  it('getSupabase throws with a clear message when env is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const mod = await import('./supabase')
    expect(() => mod.getSupabase()).toThrow(/VITE_SUPABASE/i)
  })
})
