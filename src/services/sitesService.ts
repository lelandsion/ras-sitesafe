import { supabase } from '../lib/supabase'
import type { Site } from '../types/database'

/**
 * Sites the signed-in framer is assigned to (RLS filters; join via site_assignments).
 */
export async function listAssignedSites(): Promise<{
  data: Site[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, address, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  return { data: (data ?? []) as Site[], error: null }
}

export function humanizeDbError(message: string): string {
  if (message.includes('PGRST205') || message.includes('schema cache')) {
    return 'Database tables are not applied yet. Run the SQL migration in Supabase (docs/supabase-seed-notes.md), then refresh.'
  }
  if (message.includes('JWT') || message.includes('not authenticated')) {
    return 'Session expired. Sign in again.'
  }
  return message
}
