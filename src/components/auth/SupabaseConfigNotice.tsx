import { Link } from 'react-router-dom'

type SupabaseConfigNoticeProps = {
  title?: string
  showHomeLink?: boolean
}

export function SupabaseConfigNotice({
  title = 'Sign-in unavailable',
  showHomeLink = true,
}: SupabaseConfigNoticeProps) {
  return (
    <div className="auth-loading auth-loading--config" role="alert">
      <p>
        <strong>{title}.</strong> SiteSafe cannot reach the sign-in service right
        now. Try again later or contact your admin.
      </p>
      {showHomeLink && (
        <Link className="btn btn--ghost touch-target" to="/" style={{ marginTop: '1rem' }}>
          Back to home
        </Link>
      )}
    </div>
  )
}
