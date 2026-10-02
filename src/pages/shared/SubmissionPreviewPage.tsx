import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FileDown, Printer } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/layout/AppHeader'
import {
  SubmissionReportView,
  type SubmissionReportMeta,
} from '../../components/reports/SubmissionReportView'
import { useAuth } from '../../hooks/auth-context'
import { exportSubmissionToPdf } from '../../lib/exportSubmissionPdf'
import { listSubmissionPhotos } from '../../services/photosService'
import { getSubmission } from '../../services/submissionsService'
import type { Profile, SubmissionPhoto } from '../../types/database'

type Audience = 'framer' | 'admin'

function formPath(audience: Audience, id: string): string {
  return audience === 'admin'
    ? `/admin/submissions/${id}`
    : `/framer/submissions/${id}`
}

export function SubmissionPreviewPage({ audience }: { audience: Audience }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [meta, setMeta] = useState<SubmissionReportMeta | null>(null)
  const [submitter, setSubmitter] = useState<Pick<Profile, 'id' | 'display_name'> | null>(
    null,
  )
  const [photos, setPhotos] = useState<SubmissionPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      setError('Missing submission id.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const subResult = await getSubmission(id)
    if (subResult.error || !subResult.data) {
      setError(subResult.error ?? 'Submission not found.')
      setLoading(false)
      return
    }

    const sub = subResult.data
    setSubmitter(sub.submitter)
    setMeta({
      id: sub.id,
      status: sub.status,
      notes: sub.notes,
      checklist: sub.checklist,
      created_at: sub.created_at,
      updated_at: sub.updated_at,
      siteName: sub.sites?.name ?? 'Unknown site',
      siteAddress: sub.sites?.address,
      workerName: sub.submitter?.display_name ?? profile?.display_name ?? 'Field worker',
    })

    const photoResult = await listSubmissionPhotos(id)
    if (photoResult.error) {
      setError(photoResult.error)
    } else {
      setPhotos(photoResult.data)
    }
    setLoading(false)
  }, [id, profile?.display_name])

  useEffect(() => {
    void load()
  }, [load])

  async function onExportPdf() {
    if (!meta) return
    setExporting(true)
    await exportSubmissionToPdf({
      submission: {
        id: meta.id,
        status: meta.status,
        notes: meta.notes,
        checklist: meta.checklist,
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        sites: {
          id: '',
          name: meta.siteName,
          address: meta.siteAddress ?? null,
        },
        submitter: submitter ?? (profile
          ? { id: profile.id, display_name: profile.display_name }
          : null),
      },
      photos,
    })
    setExporting(false)
  }

  const backTo = id ? formPath(audience, id) : audience === 'admin' ? '/admin' : '/framer'
  const listTo = audience === 'admin' ? '/admin' : '/framer'

  return (
    <div className="app-shell app-shell--report">
      <AppHeader />
      <main className="app-main">
        <section className="report-preview-page" aria-labelledby="preview-title">
          <div className="report-preview-page__toolbar no-print">
            <Link to={backTo} className="form-page__back touch-target">
              <ArrowLeft size={18} strokeWidth={2.5} aria-hidden />
              Back to form
            </Link>
            <div className="report-preview-page__actions">
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => window.print()}
              >
                <Printer size={20} strokeWidth={2.5} aria-hidden />
                Print
              </button>
              <button
                type="button"
                className="btn btn--primary touch-target"
                disabled={!meta || exporting}
                onClick={() => void onExportPdf()}
              >
                <FileDown size={20} strokeWidth={2.5} aria-hidden />
                {exporting ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
          </div>

          {loading && (
            <div className="panel-state" role="status">
              Loading preview…
            </div>
          )}

          {!loading && error && (
            <div className="panel-state panel-state--error" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => navigate(listTo)}
              >
                Back to list
              </button>
            </div>
          )}

          {!loading && !error && meta && (
            <>
              <h2 id="preview-title" className="visually-hidden">
                Report preview
              </h2>
              <SubmissionReportView meta={meta} photos={photos} />
            </>
          )}
        </section>
      </main>
      <footer className="app-footer no-print">
        <strong>RAS</strong> · SiteSafe · Report preview
      </footer>
    </div>
  )
}
