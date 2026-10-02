import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardCheck,
  Save,
  Send,
  Trash2,
} from 'lucide-react'
import { AppHeader } from '../../components/layout/AppHeader'
import { PhotoUpload } from '../../components/forms/PhotoUpload'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../hooks/auth-context'
import { listAssignedSites } from '../../services/sitesService'
import {
  createSubmission,
  deleteDraftSubmission,
  getSubmission,
  updateSubmission,
} from '../../services/submissionsService'
import {
  listSubmissionPhotos,
} from '../../services/photosService'
import type { Site, SubmissionPhoto, SubmissionStatus } from '../../types/database'

type Mode = 'new' | 'edit'

function isEditable(status: SubmissionStatus | null): boolean {
  return status === null || status === 'draft'
}

export function SafetyFormPage({ mode }: { mode: Mode }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<SubmissionStatus | null>(
    mode === 'new' ? null : 'draft',
  )
  const [submissionId, setSubmissionId] = useState<string | null>(
    mode === 'edit' ? (id ?? null) : null,
  )
  const [photos, setPhotos] = useState<SubmissionPhoto[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const editable = isEditable(status)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const sitesResult = await listAssignedSites()
    if (sitesResult.error) {
      setError(sitesResult.error)
      setSites([])
    } else {
      setSites(sitesResult.data)
      if (mode === 'new' && sitesResult.data.length === 1) {
        setSiteId(sitesResult.data[0].id)
      }
    }

    if (mode === 'edit' && id) {
      const subResult = await getSubmission(id)
      if (subResult.error) {
        setError(subResult.error)
        setLoading(false)
        return
      }
      if (!subResult.data) {
        setError('Submission not found.')
        setLoading(false)
        return
      }
      setSubmissionId(subResult.data.id)
      setSiteId(subResult.data.site_id)
      setNotes(subResult.data.notes ?? '')
      setStatus(subResult.data.status)

      const photoResult = await listSubmissionPhotos(id)
      if (photoResult.error) {
        setError(photoResult.error)
      } else {
        setPhotos(photoResult.data)
      }
    }

    setLoading(false)
  }, [id, mode])

  useEffect(() => {
    void load()
  }, [load])

  async function ensureDraftRow(): Promise<string | null> {
    if (!user) {
      setError('Not signed in.')
      return null
    }
    if (!siteId) {
      setError('Pick a jobsite before adding photos or saving.')
      return null
    }

    if (submissionId) return submissionId

    const { data, error: createError } = await createSubmission({
      site_id: siteId,
      submitted_by: user.id,
      notes: notes.trim() || null,
      status: 'draft',
    })

    if (createError || !data) {
      setError(createError ?? 'Could not create draft.')
      return null
    }

    setSubmissionId(data.id)
    setStatus(data.status)
    // Keep URL shareable after first save
    navigate(`/framer/submissions/${data.id}`, { replace: true })
    return data.id
  }

  async function persist(
    nextStatus: Extract<SubmissionStatus, 'draft' | 'submitted'>,
  ) {
    if (!user) {
      setError('Not signed in.')
      return
    }
    if (!siteId) {
      setError('Select a jobsite.')
      return
    }

    setSaving(true)
    setError(null)
    setInfo(null)

    let targetId = submissionId
    if (!targetId) {
      const { data, error: createError } = await createSubmission({
        site_id: siteId,
        submitted_by: user.id,
        notes: notes.trim() || null,
        status: nextStatus,
      })
      if (createError || !data) {
        setError(createError ?? 'Could not save submission.')
        setSaving(false)
        return
      }
      targetId = data.id
      setSubmissionId(data.id)
      setStatus(data.status)
    } else {
      const { data, error: updateError } = await updateSubmission(targetId, {
        site_id: siteId,
        notes: notes.trim() || null,
        status: nextStatus,
      })
      if (updateError || !data) {
        setError(updateError ?? 'Could not update submission.')
        setSaving(false)
        return
      }
      setStatus(data.status)
    }

    setSaving(false)
    if (nextStatus === 'submitted') {
      setInfo('Submitted for review.')
      navigate('/framer', { replace: true })
      return
    }

    setInfo('Draft saved.')
    navigate(`/framer/submissions/${targetId}`, { replace: true })
  }

  async function onDeleteDraft() {
    if (!submissionId || status !== 'draft') return
    if (!window.confirm('Delete this draft? Photos will be removed.')) return
    setSaving(true)
    const { error: deleteError } = await deleteDraftSubmission(submissionId)
    setSaving(false)
    if (deleteError) {
      setError(deleteError)
      return
    }
    navigate('/framer', { replace: true })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await persist('submitted')
  }

  if (loading) {
    return (
      <div className="app-shell">
        <AppHeader />
        <main className="app-main">
          <div className="panel-state" role="status">
            Loading form…
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="form-page" aria-labelledby="form-title">
          <Link to="/framer" className="form-page__back touch-target">
            <ArrowLeft size={18} strokeWidth={2.5} aria-hidden />
            My submissions
          </Link>

          <p className="form-page__kicker">Field safety</p>
          <h2 id="form-title" className="form-page__title">
            {mode === 'new' && !submissionId ? 'New report' : 'Safety report'}
            {status && (
              <span className="form-page__status">
                <StatusBadge status={status} />
              </span>
            )}
          </h2>
          <p className="form-page__lead">
            Logged as <strong>{profile?.display_name ?? 'Framer'}</strong>. Pick
            your assigned site, add notes and photos, then submit for review.
          </p>

          {sites.length === 0 && (
            <p className="form-banner form-banner--warn" role="status">
              No assigned jobsites yet. Ask an admin to create a site and assign
              you (see docs/supabase-seed-notes.md).
            </p>
          )}

          {error && (
            <p className="form-banner form-banner--error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="form-banner form-banner--ok" role="status">
              {info}
            </p>
          )}

          <form className="safety-form" onSubmit={onSubmit} noValidate>
            <label className="safety-form__field">
              <span>Jobsite</span>
              <select
                className="safety-form__control touch-target"
                name="site_id"
                required
                disabled={!editable || saving || sites.length === 0}
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                <option value="">Select site…</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                    {site.address ? ` — ${site.address}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="safety-form__field">
              <span>Safety notes</span>
              <textarea
                className="safety-form__control safety-form__textarea"
                name="notes"
                rows={6}
                disabled={!editable || saving}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Hazards, PPE, housekeeping, near misses…"
              />
            </label>

            <div className="safety-form__photos">
              {submissionId && user ? (
                <PhotoUpload
                  userId={user.id}
                  submissionId={submissionId}
                  photos={photos}
                  onChange={setPhotos}
                  disabled={!editable || saving}
                />
              ) : editable ? (
                <div className="photo-upload photo-upload--deferred">
                  <h3 className="photo-upload__title">Site photos</h3>
                  <p className="photo-upload__hint">
                    Save a draft first (or tap below) so photos attach to this
                    report.
                  </p>
                  <button
                    type="button"
                    className="btn btn--ghost touch-target"
                    disabled={saving || !siteId}
                    onClick={() => void ensureDraftRow()}
                  >
                    <Save size={20} strokeWidth={2.5} aria-hidden />
                    Create draft for photos
                  </button>
                </div>
              ) : null}
            </div>

            {editable && (
              <div className="safety-form__actions">
                <button
                  type="button"
                  className="btn btn--ghost touch-target"
                  disabled={saving || !siteId}
                  onClick={() => void persist('draft')}
                >
                  <Save size={20} strokeWidth={2.5} aria-hidden />
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary touch-target"
                  disabled={saving || !siteId}
                >
                  <Send size={20} strokeWidth={2.5} aria-hidden />
                  {saving ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            )}

            {!editable && (
              <p className="form-page__readonly">
                <ClipboardCheck size={18} strokeWidth={2.5} aria-hidden />
                This report is {status?.replace('_', ' ')} and locked for field
                edits.
              </p>
            )}

            {status === 'draft' && submissionId && (
              <button
                type="button"
                className="btn btn--danger-ghost touch-target safety-form__delete"
                disabled={saving}
                onClick={() => void onDeleteDraft()}
              >
                <Trash2 size={20} strokeWidth={2.5} aria-hidden />
                Delete draft
              </button>
            )}
          </form>
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Field form
      </footer>
    </div>
  )
}
