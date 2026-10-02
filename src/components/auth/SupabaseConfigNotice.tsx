import { Link } from 'react-router-dom'
import { SUPABASE_CONFIG_MESSAGE } from '../../lib/supabase'

type SupabaseConfigNoticeProps = {
  title?: string
  showHomeLink?: boolean
}

export function SupabaseConfigNotice({
  title = 'Supabase not configured',
  showHomeLink = true,
}: SupabaseConfigNoticeProps) {
  return (
    <div className="auth-loading auth-loading--config" role="alert">
      <p>
        <strong>{title}.</strong> {SUPABASE_CONFIG_MESSAGE}
      </p>
      <p className="auth-loading__hint">
        See <code>docs/supabase-seed-notes.md</code> for migration and seed steps after
        env is set.
      </p>
      {showHomeLink && (
        <Link className="btn btn--ghost touch-target" to="/" style={{ marginTop: '1rem' }}>
          Back to home
        </Link>
      )}
    </div>
  )
}
