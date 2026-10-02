import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0

export const SUPABASE_CONFIG_MESSAGE =
  'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local, add your Supabase project values, and restart the dev server.'

if (!isSupabaseConfigured) {
  console.warn(`[RAS SiteSafe] ${SUPABASE_CONFIG_MESSAGE}`)
}

let cachedClient: SupabaseClient | null = null

/** Returns the Supabase client after lazy initialization. Throws if env is missing. */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(`[RAS SiteSafe] ${SUPABASE_CONFIG_MESSAGE}`)
  }
  cachedClient ??= createClient(supabaseUrl, supabaseAnonKey)
  return cachedClient
}

/**
 * Lazy Supabase client for existing call sites. Does not call createClient until
 * a property is accessed (and only when env vars are present).
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase()
    const value = Reflect.get(client, prop, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
