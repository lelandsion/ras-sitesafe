import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardCheck,
  Eye,
  FileDown,
  Save,
  Send,
  Trash2,
} from 'lucide-react'
import { AppHeader } from '../../components/layout/AppHeader'
import { IssueCapturePanel } from '../../components/forms/IssueCapturePanel'
import { PhotoUpload } from '../../components/forms/PhotoUpload'
import { SubmissionIssuesPanel } from '../../components/forms/SubmissionIssuesPanel'
import { TriStateField } from '../../components/forms/TriStateField'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../hooks/auth-context'
import { exportSubmissionToPdf } from '../../lib/exportSubmissionPdf'
import {
  reconcileIssueDrafts,
  validateIssueDrafts,
  type IssueDraft,
} from '../../lib/safetyIssueKeys'
import { listAssignedSites } from '../../services/sitesService'
import {
  listIssuesForSubmission,
  syncSafetyIssuesForSubmission,
} from '../../services/safetyIssuesService'
import {
  createSubmission,
  deleteDraftSubmission,
  getSubmission,
  updateSubmission,
} from '../../services/submissionsService'
import { listSubmissionPhotos } from '../../services/photosService'
import type { SafetyIssueWithDetails } from '../../types/correctiveActions'
import type {
  Site,
  SubmissionPhoto,
  SubmissionPhotoKind,
  SubmissionStatus,
} from '../../types/database'
import {
  emptyDailySafetyChecklist,
  HAZARD_SEVERITY_LABELS,
  parseDailySafetyChecklist,
  serializeChecklist,
  validateDailySafetyChecklist,
  type DailySafetyChecklist,
  type HazardSeverity,
  type TriState,
} from '../../types/safetyChecklist'

type Mode = 'new' | 'edit'
type Audience = 'framer' | 'admin'

function isEditable(status: SubmissionStatus | null): boolean {
  return status === null || status === 'draft'
}

function submissionBasePath(audience: Audience): string {
  return audience === 'admin' ? '/admin/submissions' : '/framer/submissions'
}

export function SafetyFormPage({
  mode,
  audience = 'framer',
}: {
  mode: Mode
  audience?: Audience
}) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [notes, setNotes] = useState('')
  const [checklist, setChecklist] = useState<DailySafetyChecklist>(() =>
    emptyDailySafetyChecklist(),
  )
  const [status, setStatus] = useState<SubmissionStatus | null>(
    mode === 'new' ? null : 'draft',
  )
  const [submissionId, setSubmissionId] = useState<string | null>(
    mode === 'edit' ? (id ?? null) : null,
  )
  const [photos, setPhotos] = useState<SubmissionPhoto[]>([])
  const [issueDrafts, setIssueDrafts] = useState<Record<string, IssueDraft>>({})
  const [savedIssues, setSavedIssues] = useState<SafetyIssueWithDetails[]>([])
  const [issuesLoading, setIssuesLoading] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  /** Avoid draft-create race when first photo upload runs before setState lands. */
  const submissionIdRef = useRef<string | null>(submissionId)
  submissionIdRef.current = submissionId
  const draftCreatePromiseRef = useRef<Promise<string | null> | null>(null)

  function updateChecklist(next: DailySafetyChecklist) {
    setChecklist(next)
    setIssueDrafts((prev) => reconcileIssueDrafts(next, prev))
  }

  function setTri(
    apply: (c: DailySafetyChecklist, value: TriState) => DailySafetyChecklist,
    value: TriState,
  ) {
    setChecklist((c) => {
      const next = apply(c, value)
      setIssueDrafts((prev) => reconcileIssueDrafts(next, prev))
      return next
    })
  }

  const editable = isEditable(status)
  const isAdmin = audience === 'admin'
  const basePath = submissionBasePath(audience)
  const listPath = isAdmin ? '/admin' : '/framer'

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === siteId) ?? null,
    [sites, siteId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Admin and framer both use the active-sites query; RLS scopes rows.
    // Avoid listAdminSites() here — its assignment-count embed is unrelated
    // to the picker and can fail independently of whether sites exist.
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
      const parsed = parseDailySafetyChecklist(
        subResult.data.checklist,
        subResult.data.created_at.slice(0, 10),
      )
      setChecklist(parsed)
      setStatus(subResult.data.status)

      const photoResult = await listSubmissionPhotos(id)
      if (photoResult.error) {
        setError(photoResult.error)
      } else {
        setPhotos(photoResult.data)
      }

      setIssuesLoading(true)
      const issuesResult = await listIssuesForSubmission(id)
      setIssuesLoading(false)
      if (issuesResult.error) {
        setError((prev) => prev ?? issuesResult.error)
      } else {
        setSavedIssues(issuesResult.data)
        // Prefill drafts from saved rows when still editable.
        if (subResult.data.status === 'draft') {
          const fromDb: Record<string, IssueDraft> = {}
          for (const issue of issuesResult.data) {
            fromDb[issue.checklist_item_key] = {
              checklist_item_key:
                issue.checklist_item_key as IssueDraft['checklist_item_key'],
              item_label: issue.item_label,
              description: issue.description,
              severity: issue.severity,
              immediate_action: issue.immediate_action,
              pendingPhoto: null,
            }
          }
          setIssueDrafts(reconcileIssueDrafts(parsed, fromDb))
        }
      }
    }

    setLoading(false)
  }, [id, mode])

  useEffect(() => {
    void load()
  }, [load])

  async function ensureSubmissionId(): Promise<string | null> {
    if (!user) {
      setError('Not signed in.')
      return null
    }
    if (!siteId) {
      setError('Pick a jobsite before adding photos or saving.')
      return null
    }

    if (submissionIdRef.current) return submissionIdRef.current
    if (draftCreatePromiseRef.current) return draftCreatePromiseRef.current

    // Create draft for photo FK / storage path — do NOT navigate here.
    // Navigating /new → /submissions/:id remounts the form (different Route)
    // and races the in-flight upload (first select appears to fail; second works).
    draftCreatePromiseRef.current = (async () => {
      const { data, error: createError } = await createSubmission({
        site_id: siteId,
        submitted_by: user.id,
        notes: notes.trim() || null,
        checklist: serializeChecklist(checklist),
        status: 'draft',
      })

      if (createError || !data) {
        setError(createError ?? 'Could not create draft.')
        return null
      }

      submissionIdRef.current = data.id
      setSubmissionId(data.id)
      setStatus(data.status)
      return data.id
    })()

    try {
      return await draftCreatePromiseRef.current
    } finally {
      draftCreatePromiseRef.current = null
    }
  }

  function setPhotosForKind(kind: SubmissionPhotoKind, kindPhotos: SubmissionPhoto[]) {
    setPhotos((prev) => [
      ...prev.filter((p) => (p.photo_kind ?? 'site') !== kind),
      ...kindPhotos,
    ])
  }

  const sitePhotos = useMemo(
    () => photos.filter((p) => (p.photo_kind ?? 'site') === 'site'),
    [photos],
  )
  const hazardPhotos = useMemo(
    () => photos.filter((p) => p.photo_kind === 'hazard'),
    [photos],
  )

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

    if (nextStatus === 'submitted') {
      const validationError = validateDailySafetyChecklist(checklist)
      if (validationError) {
        setError(validationError)
        return
      }
      const drafts = reconcileIssueDrafts(checklist, issueDrafts)
      const issueError = validateIssueDrafts(drafts)
      if (issueError) {
        setError(issueError)
        setIssueDrafts(drafts)
        return
      }
    }

    setSaving(true)
    setError(null)
    setInfo(null)

    const payload = {
      site_id: siteId,
      notes: notes.trim() || null,
      checklist: serializeChecklist(checklist),
      status: nextStatus,
    }

    const draftsToSync = reconcileIssueDrafts(checklist, issueDrafts)
    setIssueDrafts(draftsToSync)

    let targetId = submissionIdRef.current
    if (!targetId) {
      const { data, error: createError } = await createSubmission({
        submitted_by: user.id,
        ...payload,
      })
      if (createError || !data) {
        setError(createError ?? 'Could not save submission.')
        setSaving(false)
        return
      }
      targetId = data.id
      submissionIdRef.current = data.id
      setSubmissionId(data.id)
      setStatus(data.status)
    } else {
      const { data, error: updateError } = await updateSubmission(targetId, payload)
      if (updateError || !data) {
        setError(updateError ?? 'Could not update submission.')
        setSaving(false)
        return
      }
      setStatus(data.status)
    }

    // Upsert issues after submission exists — unique key prevents duplicates.
    const { error: syncError } = await syncSafetyIssuesForSubmission({
      submissionId: targetId,
      createdBy: user.id,
      drafts: draftsToSync,
    })
    if (syncError) {
      setError(syncError)
      setSaving(false)
      return
    }

    // Clear pending local files after successful sync.
    setIssueDrafts((prev) => {
      const cleared: Record<string, IssueDraft> = {}
      for (const [k, d] of Object.entries(prev)) {
        cleared[k] = { ...d, pendingPhoto: null }
      }
      return cleared
    })

    const refreshed = await listIssuesForSubmission(targetId)
    if (!refreshed.error) setSavedIssues(refreshed.data)

    setSaving(false)
    if (nextStatus === 'submitted') {
      setInfo('Safety check submitted for review.')
      navigate('/framer', { replace: true })
      return
    }

    setInfo(isAdmin ? 'Report saved.' : 'Draft saved.')
    navigate(`${basePath}/${targetId}`, { replace: true })
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
    navigate(listPath, { replace: true })
  }

  async function syncDraftForPreview(): Promise<string | null> {
    if (!siteId) {
      setError('Select a jobsite first.')
      return null
    }
    const sid = await ensureSubmissionId()
    if (!sid || !user) return null
    const { error: updateError } = await updateSubmission(sid, {
      site_id: siteId,
      notes: notes.trim() || null,
      checklist: serializeChecklist(checklist),
      status: 'draft',
    })
    if (updateError) {
      setError(updateError)
      return null
    }
    return sid
  }

  async function onPreview() {
    setSaving(true)
    const sid = await syncDraftForPreview()
    setSaving(false)
    if (!sid) return
    navigate(`${basePath}/${sid}/preview`)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await persist('submitted')
  }

  async function onExportPdf() {
    setSaving(true)
    const sid = submissionId ?? (await syncDraftForPreview())
    setSaving(false)
    if (!sid) return
    await exportSubmissionToPdf({
      submission: {
        id: sid,
        status: status ?? 'draft',
        notes,
        checklist: serializeChecklist(checklist),
        created_at: checklist.checkDate,
        updated_at: new Date().toISOString(),
        sites: selectedSite
          ? {
              id: selectedSite.id,
              name: selectedSite.name,
              address: selectedSite.address,
            }
          : null,
        submitter: profile
          ? { id: profile.id, display_name: profile.display_name }
          : null,
      },
      photos,
    })
  }

  const photoAttachHint =
    !siteId && editable ? 'Select a jobsite first.' : null

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
          <Link to={listPath} className="form-page__back touch-target">
            <ArrowLeft size={18} strokeWidth={2.5} aria-hidden />
            {isAdmin ? 'Admin dashboard' : 'My submissions'}
          </Link>

          <p className="form-page__kicker">RAS SiteSafe</p>
          <h2 id="form-title" className="form-page__title">
            DAILY SAFETY CHECK
            {status && (
              <span className="form-page__status">
                <StatusBadge status={status} />
              </span>
            )}
          </h2>

          <div className="check-header-card">
            <p>
              <span className="check-header-card__label">Site</span>
              {selectedSite?.name ?? 'Select below'}
            </p>
            <p>
              <span className="check-header-card__label">Date</span>
              <input
                type="date"
                className="check-header-card__date safety-form__control"
                value={checklist.checkDate}
                disabled={!editable || saving}
                onChange={(e) =>
                  updateChecklist({ ...checklist, checkDate: e.target.value })
                }
              />
            </p>
            <p>
              <span className="check-header-card__label">Worker</span>
              {profile?.display_name ?? 'Framer'}
            </p>
          </div>

          {sites.length === 0 && (
            <p className="form-banner form-banner--warn" role="status">
              {isAdmin ? (
                <>
                  No active jobsites yet. Create one under{' '}
                  <Link to="/admin/sites">Admin → Sites</Link>, then return here
                  to file a check.
                </>
              ) : (
                <>
                  No assigned jobsites yet. Ask an admin to assign you on{' '}
                  <strong>Sites</strong>, then refresh this page.
                </>
              )}
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

            {user && (
              <section
                className="check-section check-section--site-photos"
                aria-labelledby="site-photos-heading"
                data-testid="site-photos-section"
              >
                <h3 id="site-photos-heading" className="check-section__title">
                  Site photos
                </h3>
                <p className="check-section__lead">
                  Always available — add general jobsite photos anytime. Hazard
                  evidence belongs under Hazards below.
                </p>
                <PhotoUpload
                  userId={user.id}
                  submissionId={submissionId}
                  ensureSubmissionId={ensureSubmissionId}
                  photos={sitePhotos}
                  onChange={(next) => setPhotosForKind('site', next)}
                  disabled={!editable || saving}
                  blockedHint={photoAttachHint}
                  title="Site photos"
                  showTitle={false}
                  triggerLabel="Add site photo"
                  photoKind="site"
                />
              </section>
            )}

            <section className="check-section" aria-labelledby="ppe-heading">
              <h3 id="ppe-heading" className="check-section__title">
                PPE
              </h3>
              <TriStateField
                label="Hard hat worn"
                name="ppe-hardHat"
                value={checklist.ppe.hardHat}
                disabled={!editable || saving}
                onChange={(hardHat) =>
                  setTri(
                    (c, v) => ({ ...c, ppe: { ...c.ppe, hardHat: v } }),
                    hardHat,
                  )
                }
              />
              {editable && issueDrafts['ppe.hardHat'] && (
                <IssueCapturePanel
                  draft={issueDrafts['ppe.hardHat']}
                  disabled={saving}
                  onChange={(d) =>
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                  }
                />
              )}
              <TriStateField
                label="High-vis vest"
                name="ppe-highVis"
                value={checklist.ppe.highVis}
                disabled={!editable || saving}
                onChange={(highVis) =>
                  setTri(
                    (c, v) => ({ ...c, ppe: { ...c.ppe, highVis: v } }),
                    highVis,
                  )
                }
              />
              {editable && issueDrafts['ppe.highVis'] && (
                <IssueCapturePanel
                  draft={issueDrafts['ppe.highVis']}
                  disabled={saving}
                  onChange={(d) =>
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                  }
                />
              )}
              <TriStateField
                label="Appropriate footwear"
                name="ppe-footwear"
                value={checklist.ppe.footwear}
                disabled={!editable || saving}
                onChange={(footwear) =>
                  setTri(
                    (c, v) => ({ ...c, ppe: { ...c.ppe, footwear: v } }),
                    footwear,
                  )
                }
              />
              {editable && issueDrafts['ppe.footwear'] && (
                <IssueCapturePanel
                  draft={issueDrafts['ppe.footwear']}
                  disabled={saving}
                  onChange={(d) =>
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                  }
                />
              )}
              <TriStateField
                label="Eye protection (when required)"
                name="ppe-eye"
                value={checklist.ppe.eyeProtection}
                disabled={!editable || saving}
                onChange={(eyeProtection) =>
                  setTri(
                    (c, v) => ({
                      ...c,
                      ppe: { ...c.ppe, eyeProtection: v },
                    }),
                    eyeProtection,
                  )
                }
              />
              {editable && issueDrafts['ppe.eyeProtection'] && (
                <IssueCapturePanel
                  draft={issueDrafts['ppe.eyeProtection']}
                  disabled={saving}
                  onChange={(d) =>
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                  }
                />
              )}
            </section>

            <section className="check-section" aria-labelledby="fp-heading">
              <h3 id="fp-heading" className="check-section__title">
                Fall protection
              </h3>
              <TriStateField
                label="Edges / openings protected"
                name="fp-edges"
                value={checklist.fallProtection.edgesProtected}
                disabled={!editable || saving}
                onChange={(edgesProtected) =>
                  setTri(
                    (c, v) => ({
                      ...c,
                      fallProtection: { ...c.fallProtection, edgesProtected: v },
                    }),
                    edgesProtected,
                  )
                }
              />
              {editable && issueDrafts['fallProtection.edgesProtected'] && (
                <IssueCapturePanel
                  draft={issueDrafts['fallProtection.edgesProtected']}
                  disabled={saving}
                  onChange={(d) =>
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                  }
                />
              )}
              <TriStateField
                label="Fall protection in use"
                name="fp-inuse"
                value={checklist.fallProtection.fpInUse}
                disabled={!editable || saving}
                onChange={(fpInUse) =>
                  setTri(
                    (c, v) => ({
                      ...c,
                      fallProtection: { ...c.fallProtection, fpInUse: v },
                    }),
                    fpInUse,
                  )
                }
              />
              {editable && issueDrafts['fallProtection.fpInUse'] && (
                <IssueCapturePanel
                  draft={issueDrafts['fallProtection.fpInUse']}
                  disabled={saving}
                  onChange={(d) =>
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                  }
                />
              )}
              <TriStateField
                label="Ladders / access safe"
                name="fp-ladders"
                value={checklist.fallProtection.ladders}
                disabled={!editable || saving}
                onChange={(ladders) =>
                  setTri(
                    (c, v) => ({
                      ...c,
                      fallProtection: { ...c.fallProtection, ladders: v },
                    }),
                    ladders,
                  )
                }
              />
              {editable && issueDrafts['fallProtection.ladders'] && (
                <IssueCapturePanel
                  draft={issueDrafts['fallProtection.ladders']}
                  disabled={saving}
                  onChange={(d) =>
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                  }
                />
              )}
            </section>

            <section className="check-section" aria-labelledby="tools-heading">
              <h3 id="tools-heading" className="check-section__title">
                Tools & work area
              </h3>
              <TriStateField
                label="Tools / equipment condition OK"
                name="tools-condition"
                value={checklist.toolsAndWorkArea.toolsCondition}
                disabled={!editable || saving}
                onChange={(toolsCondition) =>
                  setTri(
                    (c, v) => ({
                      ...c,
                      toolsAndWorkArea: {
                        ...c.toolsAndWorkArea,
                        toolsCondition: v,
                      },
                    }),
                    toolsCondition,
                  )
                }
              />
              {editable && issueDrafts['toolsAndWorkArea.toolsCondition'] && (
                <IssueCapturePanel
                  draft={issueDrafts['toolsAndWorkArea.toolsCondition']}
                  disabled={saving}
                  onChange={(d) =>
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                  }
                />
              )}
              <TriStateField
                label="Work area clear"
                name="tools-clear"
                value={checklist.toolsAndWorkArea.workAreaClear}
                disabled={!editable || saving}
                onChange={(workAreaClear) =>
                  setTri(
                    (c, v) => ({
                      ...c,
                      toolsAndWorkArea: {
                        ...c.toolsAndWorkArea,
                        workAreaClear: v,
                      },
                    }),
                    workAreaClear,
                  )
                }
              />
              {editable && issueDrafts['toolsAndWorkArea.workAreaClear'] && (
                <IssueCapturePanel
                  draft={issueDrafts['toolsAndWorkArea.workAreaClear']}
                  disabled={saving}
                  onChange={(d) =>
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                  }
                />
              )}
              <TriStateField
                label="Housekeeping acceptable"
                name="tools-housekeeping"
                value={checklist.toolsAndWorkArea.housekeeping}
                disabled={!editable || saving}
                onChange={(housekeeping) =>
                  setTri(
                    (c, v) => ({
                      ...c,
                      toolsAndWorkArea: {
                        ...c.toolsAndWorkArea,
                        housekeeping: v,
                      },
                    }),
                    housekeeping,
                  )
                }
              />
              {editable && issueDrafts['toolsAndWorkArea.housekeeping'] && (
                <IssueCapturePanel
                  draft={issueDrafts['toolsAndWorkArea.housekeeping']}
                  disabled={saving}
                  onChange={(d) =>
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                  }
                />
              )}
            </section>

            <section className="check-section" aria-labelledby="hazards-heading">
              <h3 id="hazards-heading" className="check-section__title">
                Hazards
              </h3>
              <fieldset className="yesno-field" disabled={!editable || saving}>
                <legend className="yesno-field__legend">
                  Hazard observed on site?
                </legend>
                <div className="yesno-field__options">
                  {(
                    [
                      [true, 'Yes'],
                      [false, 'No'],
                    ] as const
                  ).map(([val, label]) => (
                    <label key={String(val)} className="yesno-field__option touch-target">
                      <input
                        type="radio"
                        name="hazards-present"
                        checked={checklist.hazards.present === val}
                        onChange={() =>
                          setChecklist((c) => {
                            const next = {
                              ...c,
                              hazards: {
                                ...c.hazards,
                                present: val,
                                description: val ? c.hazards.description : '',
                                severity: val ? c.hazards.severity : null,
                              },
                            }
                            setIssueDrafts((prev) =>
                              reconcileIssueDrafts(next, prev),
                            )
                            return next
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {checklist.hazards.present && (
                <>
                  <label className="safety-form__field">
                    <span>Hazard description *</span>
                    <textarea
                      className="safety-form__control safety-form__textarea"
                      rows={3}
                      required
                      disabled={!editable || saving}
                      value={checklist.hazards.description}
                      onChange={(e) => {
                        const description = e.target.value
                        setChecklist((c) => {
                          const next = {
                            ...c,
                            hazards: { ...c.hazards, description },
                          }
                          setIssueDrafts((prev) => {
                            const reconciled = reconcileIssueDrafts(next, prev)
                            const h = reconciled.hazards
                            if (h) {
                              reconciled.hazards = {
                                ...h,
                                description:
                                  h.description || description.trim(),
                              }
                            }
                            return reconciled
                          })
                          return next
                        })
                      }}
                    />
                  </label>
                  <label className="safety-form__field">
                    <span>Severity *</span>
                    <select
                      className="safety-form__control touch-target"
                      required
                      disabled={!editable || saving}
                      value={checklist.hazards.severity ?? ''}
                      onChange={(e) => {
                        const severity = e.target.value as HazardSeverity
                        setChecklist((c) => {
                          const next = {
                            ...c,
                            hazards: { ...c.hazards, severity },
                          }
                          setIssueDrafts((prev) =>
                            reconcileIssueDrafts(next, prev),
                          )
                          return next
                        })
                      }}
                    >
                      <option value="">Select…</option>
                      {(Object.keys(HAZARD_SEVERITY_LABELS) as HazardSeverity[]).map(
                        (s) => (
                          <option key={s} value={s}>
                            {HAZARD_SEVERITY_LABELS[s]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  {user && (
                    <PhotoUpload
                      userId={user.id}
                      submissionId={submissionId}
                      ensureSubmissionId={ensureSubmissionId}
                      photos={hazardPhotos}
                      onChange={(next) => setPhotosForKind('hazard', next)}
                      disabled={!editable || saving}
                      blockedHint={photoAttachHint}
                      title="Hazard photos"
                      showTitle
                      triggerLabel="Add hazard photo"
                      photoKind="hazard"
                    />
                  )}
                  {editable && issueDrafts.hazards && (
                    <>
                      <label className="safety-form__field">
                        <span>Immediate action *</span>
                        <textarea
                          className="safety-form__control safety-form__textarea"
                          rows={2}
                          required
                          disabled={saving}
                          value={issueDrafts.hazards.immediate_action}
                          onChange={(e) =>
                            setIssueDrafts((prev) => ({
                              ...prev,
                              hazards: {
                                ...prev.hazards!,
                                immediate_action: e.target.value,
                                description:
                                  checklist.hazards.description.trim() ||
                                  prev.hazards!.description,
                                severity:
                                  prev.hazards!.severity ??
                                  (checklist.hazards.severity === 'moderate'
                                    ? 'medium'
                                    : checklist.hazards.severity),
                              },
                            }))
                          }
                          placeholder="What did the crew do right away?"
                        />
                      </label>
                      <label className="safety-form__field">
                        <span>Issue photo (optional)</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="safety-form__control"
                          disabled={saving}
                          onChange={(e) =>
                            setIssueDrafts((prev) => ({
                              ...prev,
                              hazards: {
                                ...prev.hazards!,
                                pendingPhoto: e.target.files?.[0] ?? null,
                              },
                            }))
                          }
                        />
                      </label>
                    </>
                  )}
                </>
              )}
            </section>

            <section className="check-section" aria-labelledby="incident-heading">
              <h3 id="incident-heading" className="check-section__title">
                Incident / near miss
              </h3>
              <fieldset className="yesno-field" disabled={!editable || saving}>
                <legend className="yesno-field__legend">
                  Incident or near miss today?
                </legend>
                <div className="yesno-field__options">
                  {(
                    [
                      [true, 'Yes'],
                      [false, 'No'],
                    ] as const
                  ).map(([val, label]) => (
                    <label key={String(val)} className="yesno-field__option touch-target">
                      <input
                        type="radio"
                        name="incident-occurred"
                        checked={checklist.incidentOrNearMiss.occurred === val}
                        onChange={() =>
                          setChecklist((c) => {
                            const next = {
                              ...c,
                              incidentOrNearMiss: {
                                occurred: val,
                                detail: val ? c.incidentOrNearMiss.detail : '',
                              },
                            }
                            setIssueDrafts((prev) =>
                              reconcileIssueDrafts(next, prev),
                            )
                            return next
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {checklist.incidentOrNearMiss.occurred && (
                <>
                  <label className="safety-form__field">
                    <span>Details *</span>
                    <textarea
                      className="safety-form__control safety-form__textarea"
                      rows={3}
                      required
                      disabled={!editable || saving}
                      value={checklist.incidentOrNearMiss.detail}
                      onChange={(e) => {
                        const detail = e.target.value
                        setChecklist((c) => {
                          const next = {
                            ...c,
                            incidentOrNearMiss: {
                              ...c.incidentOrNearMiss,
                              detail,
                            },
                          }
                          setIssueDrafts((prev) => {
                            const reconciled = reconcileIssueDrafts(next, prev)
                            const inc = reconciled.incidentOrNearMiss
                            if (inc) {
                              reconciled.incidentOrNearMiss = {
                                ...inc,
                                description:
                                  inc.description || detail.trim(),
                              }
                            }
                            return reconciled
                          })
                          return next
                        })
                      }}
                    />
                  </label>
                  {editable && issueDrafts.incidentOrNearMiss && (
                    <>
                      <label className="safety-form__field">
                        <span>Immediate action *</span>
                        <textarea
                          className="safety-form__control safety-form__textarea"
                          rows={2}
                          required
                          disabled={saving}
                          value={
                            issueDrafts.incidentOrNearMiss.immediate_action
                          }
                          onChange={(e) =>
                            setIssueDrafts((prev) => ({
                              ...prev,
                              incidentOrNearMiss: {
                                ...prev.incidentOrNearMiss!,
                                immediate_action: e.target.value,
                                description:
                                  checklist.incidentOrNearMiss.detail.trim() ||
                                  prev.incidentOrNearMiss!.description,
                                severity:
                                  prev.incidentOrNearMiss!.severity ?? 'high',
                              },
                            }))
                          }
                          placeholder="What did the crew do right away?"
                        />
                      </label>
                      <label className="safety-form__field">
                        <span>Issue photo (optional)</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="safety-form__control"
                          disabled={saving}
                          onChange={(e) =>
                            setIssueDrafts((prev) => ({
                              ...prev,
                              incidentOrNearMiss: {
                                ...prev.incidentOrNearMiss!,
                                pendingPhoto: e.target.files?.[0] ?? null,
                              },
                            }))
                          }
                        />
                      </label>
                    </>
                  )}
                </>
              )}
            </section>

            <label className="safety-form__field">
              <span>Additional notes</span>
              <textarea
                className="safety-form__control safety-form__textarea"
                name="notes"
                rows={4}
                disabled={!editable || saving}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else the office should know…"
              />
            </label>

            {editable && (
              <div className="safety-form__actions">
                <button
                  type="button"
                  className="btn btn--ghost touch-target"
                  disabled={saving || !siteId}
                  onClick={() => void persist('draft')}
                >
                  <Save size={20} strokeWidth={2.5} aria-hidden />
                  {saving ? 'Saving…' : isAdmin ? 'Save' : 'Save draft'}
                </button>
                {!isAdmin && (
                  <button
                    type="submit"
                    className="btn btn--primary touch-target"
                    disabled={saving || !siteId}
                  >
                    <Send size={20} strokeWidth={2.5} aria-hidden />
                    {saving ? 'Submitting…' : 'Submit Safety Check'}
                  </button>
                )}
                {(submissionId || siteId) && (
                  <>
                    <button
                      type="button"
                      className="btn btn--ghost touch-target"
                      disabled={saving || !siteId}
                      onClick={() => void onPreview()}
                    >
                      <Eye size={20} strokeWidth={2.5} aria-hidden />
                      Preview report
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost touch-target"
                      disabled={saving || !siteId}
                      onClick={() => void onExportPdf()}
                    >
                      <FileDown size={20} strokeWidth={2.5} aria-hidden />
                      Export PDF
                    </button>
                  </>
                )}
              </div>
            )}

            {!editable && (
              <>
                <p className="form-page__readonly">
                  <ClipboardCheck size={18} strokeWidth={2.5} aria-hidden />
                  This check is {status?.replace('_', ' ')} and locked for field
                  edits.
                </p>
                <SubmissionIssuesPanel
                  issues={savedIssues}
                  loading={issuesLoading}
                />
                <div className="safety-form__actions">
                  <Link
                    to={`${basePath}/${submissionId}/preview`}
                    className="btn btn--ghost touch-target"
                  >
                    <Eye size={20} strokeWidth={2.5} aria-hidden />
                    Preview report
                  </Link>
                  <button
                    type="button"
                    className="btn btn--ghost touch-target"
                    onClick={() => void onExportPdf()}
                  >
                    <FileDown size={20} strokeWidth={2.5} aria-hidden />
                    Export PDF
                  </button>
                </div>
              </>
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
        <strong>RAS</strong> · SiteSafe · Daily Safety Check
      </footer>
    </div>
  )
}
