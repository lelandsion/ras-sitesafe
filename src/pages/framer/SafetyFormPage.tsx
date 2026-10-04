import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
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
  allowImplicitFormSubmit,
  persistSuccessMessage,
  readFormNotice,
  shouldLeaveFormAfterPersist,
  statusForPersistIntent,
  type PersistIntent,
} from '../../lib/submissionPersist'
import {
  collectIssueDraftErrors,
  issuePhotoCaptureAllowed,
  reconcileIssueDrafts,
  requiredIssueSpecs,
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
  collectDailySafetyChecklistErrors,
  emptyDailySafetyChecklist,
  HAZARD_SEVERITY_LABELS,
  parseDailySafetyChecklist,
  serializeChecklist,
  type ChecklistFieldKey,
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
  const location = useLocation()
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
  /** Distinguishes draft vs submit so labels never show "Submitting…" on draft save. */
  const [persistMode, setPersistMode] = useState<PersistIntent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitMessages, setSubmitMessages] = useState<string[]>([])

  /** Avoid draft-create race when first photo upload runs before setState lands. */
  const submissionIdRef = useRef<string | null>(submissionId)
  submissionIdRef.current = submissionId
  const draftCreatePromiseRef = useRef<Promise<string | null> | null>(null)

  function updateChecklist(next: DailySafetyChecklist) {
    setChecklist(next)
    setIssueDrafts((prev) => reconcileIssueDrafts(next, prev))
  }

  function setTri(
    field: ChecklistFieldKey,
    apply: (c: DailySafetyChecklist, value: TriState) => DailySafetyChecklist,
    value: TriState,
  ) {
    clearFieldError(field)
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

  // Survive /new → /:id remount after Save Draft (Route swap clears React state).
  useEffect(() => {
    const notice = readFormNotice(location.state)
    if (!notice) return
    setInfo(notice)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate])

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
  const issuePhotos = useMemo(
    () => photos.filter((p) => p.photo_kind === 'issue'),
    [photos],
  )
  /** One shared issue PhotoUpload — first open checklist-No panel hosts it. */
  const issuePhotoHostKey = useMemo(() => {
    for (const spec of requiredIssueSpecs(checklist)) {
      if (issuePhotoCaptureAllowed(spec.key)) return spec.key
    }
    return null
  }, [checklist])

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function issueFieldErrors(key: string) {
    return {
      description: fieldErrors[`issue.${key}.description`],
      severity: fieldErrors[`issue.${key}.severity`],
      immediate_action: fieldErrors[`issue.${key}.immediate_action`],
    }
  }

  /**
   * Persist the Daily Safety Check.
   * `intent` is the only status switch — draft never finalizes / never sets submitted.
   */
  async function persist(intent: PersistIntent) {
    if (!user) {
      setError('Not signed in.')
      return
    }

    const nextStatus = statusForPersistIntent(intent)

    if (intent === 'submit') {
      const checklistErrors = collectDailySafetyChecklistErrors(checklist, {
        siteId,
      })
      const drafts = reconcileIssueDrafts(checklist, issueDrafts)
      const issueErrors = collectIssueDraftErrors(drafts)
      const all = [...checklistErrors, ...issueErrors]
      if (all.length > 0) {
        const map: Record<string, string> = {}
        for (const err of all) map[err.field] = err.message
        setFieldErrors(map)
        setSubmitMessages(all.map((e) => e.message))
        setIssueDrafts(drafts)
        setError(null)
        setInfo(null)
        return
      }
      setFieldErrors({})
      setSubmitMessages([])
    } else if (!siteId) {
      setFieldErrors({ siteId: 'Select a jobsite.' })
      setSubmitMessages(['Select a jobsite.'])
      setError(null)
      return
    }

    setPersistMode(intent)
    setSaving(true)
    setError(null)
    setInfo(null)
    setFieldErrors({})
    setSubmitMessages([])

    // Persist checklist content as draft first. Issue sync uses UPDATE/DELETE RLS
    // that only allows framers while the parent submission is still `draft`.
    // Flipping to `submitted` before sync causes:
    // "new row violates row-level security policy (USING expression) for table safety_issues".
    const contentPayload = {
      site_id: siteId,
      notes: notes.trim() || null,
      checklist: serializeChecklist(checklist),
      status: 'draft' as const,
    }

    const draftsToSync = reconcileIssueDrafts(checklist, issueDrafts)
    setIssueDrafts(draftsToSync)

    let targetId = submissionIdRef.current
    if (!targetId) {
      const { data, error: createError } = await createSubmission({
        submitted_by: user.id,
        ...contentPayload,
      })
      if (createError || !data) {
        setError(createError ?? 'Could not save submission.')
        setSaving(false)
        setPersistMode(null)
        return
      }
      targetId = data.id
      submissionIdRef.current = data.id
      setSubmissionId(data.id)
    } else {
      const { data, error: updateError } = await updateSubmission(targetId, {
        ...contentPayload,
      })
      if (updateError || !data) {
        setError(updateError ?? 'Could not update submission.')
        setSaving(false)
        setPersistMode(null)
        return
      }
    }

    // Submit: sync all issues (validated) while still draft. Draft save: upsert
    // only complete rows, never prune — incomplete capture stays local until Submit.
    const draftsForSync =
      intent === 'submit'
        ? draftsToSync
        : Object.fromEntries(
            Object.entries(draftsToSync).filter(
              ([, d]) =>
                Boolean(
                  d.description.trim() &&
                    d.severity &&
                    d.immediate_action.trim(),
                ),
            ),
          )

    if (intent === 'submit' || Object.keys(draftsForSync).length > 0) {
      const { error: syncError } = await syncSafetyIssuesForSubmission({
        submissionId: targetId,
        createdBy: user.id,
        drafts: draftsForSync,
        pruneMissing: intent === 'submit',
      })
      if (syncError) {
        setError(syncError)
        setSaving(false)
        setPersistMode(null)
        return
      }
    }

    // Now apply the intended status (draft stays draft; submit → submitted).
    if (intent === 'submit') {
      const { data, error: submitError } = await updateSubmission(targetId, {
        ...contentPayload,
        status: nextStatus,
      })
      if (submitError || !data) {
        setError(submitError ?? 'Could not submit safety check.')
        setSaving(false)
        setPersistMode(null)
        return
      }
      setStatus(nextStatus)
    } else {
      setStatus('draft')
    }

    const refreshed = await listIssuesForSubmission(targetId)
    if (!refreshed.error) setSavedIssues(refreshed.data)

    const photoResult = await listSubmissionPhotos(targetId)
    if (!photoResult.error) setPhotos(photoResult.data)

    setSaving(false)
    setPersistMode(null)

    const message = persistSuccessMessage(intent, isAdmin)
    if (shouldLeaveFormAfterPersist(intent)) {
      setInfo(message)
      navigate('/framer', { replace: true })
      return
    }

    // Draft: stay on the form. Carry notice across /new → /:id remount.
    const editPath = `${basePath}/${targetId}`
    if (mode === 'new' || location.pathname !== editPath) {
      navigate(editPath, {
        replace: true,
        state: { formNotice: message },
      })
      return
    }
    setInfo(message)
  }

  async function onSaveDraft(
    e?: { preventDefault: () => void; stopPropagation: () => void },
  ) {
    e?.preventDefault()
    e?.stopPropagation()
    await persist('draft')
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

  function onFormSubmit(e: FormEvent) {
    e.preventDefault()
    // Enter / native submit must never finalize — only the Submit button.
    if (!allowImplicitFormSubmit()) return
  }

  async function onSubmitSafetyCheck() {
    await persist('submit')
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

  const issuePhotoUploadBase =
    user && editable
      ? {
          userId: user.id,
          submissionId,
          ensureSubmissionId,
          photos: issuePhotos,
          onChange: (next: SubmissionPhoto[]) =>
            setPhotosForKind('issue', next),
          blockedHint: photoAttachHint,
        }
      : null

  function issuePhotoUploadFor(key: string) {
    if (!issuePhotoUploadBase || issuePhotoHostKey !== key) return null
    return issuePhotoUploadBase
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
                onChange={(e) => {
                  clearFieldError('checkDate')
                  updateChecklist({ ...checklist, checkDate: e.target.value })
                }}
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
          {submitMessages.length > 0 && (
            <div className="form-banner form-banner--error" role="alert">
              <strong>
                Fix {submitMessages.length} item
                {submitMessages.length === 1 ? '' : 's'} before submitting:
              </strong>
              <ul>
                {submitMessages.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
          {info && (
            <p className="form-banner form-banner--ok" role="status">
              {info}
            </p>
          )}

          <form
            className="safety-form"
            onSubmit={onFormSubmit}
            noValidate
          >
            <label className="safety-form__field">
              <span>Jobsite</span>
              <select
                className={`safety-form__control touch-target${fieldErrors.siteId ? ' is-invalid' : ''}`}
                name="site_id"
                disabled={!editable || saving || sites.length === 0}
                value={siteId}
                aria-invalid={fieldErrors.siteId ? true : undefined}
                onChange={(e) => {
                  setSiteId(e.target.value)
                  clearFieldError('siteId')
                }}
              >
                <option value="">Select site…</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                    {site.address ? ` — ${site.address}` : ''}
                  </option>
                ))}
              </select>
              {fieldErrors.siteId && (
                <span className="field-error" role="alert">
                  {fieldErrors.siteId}
                </span>
              )}
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
                    'ppe.hardHat',
                    (c, v) => ({ ...c, ppe: { ...c.ppe, hardHat: v } }),
                    hardHat,
                  )
                }
                error={fieldErrors['ppe.hardHat']}
              />
              {editable && issueDrafts['ppe.hardHat'] && (
                <IssueCapturePanel
                  draft={issueDrafts['ppe.hardHat']}
                  disabled={saving}
                  onChange={(d) => {
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                    clearFieldError('issue.ppe.hardHat.description')
                    clearFieldError('issue.ppe.hardHat.severity')
                    clearFieldError('issue.ppe.hardHat.immediate_action')
                  }}
                  errors={issueFieldErrors('ppe.hardHat')}
                  photoUpload={issuePhotoUploadFor('ppe.hardHat')}
                />
              )}
              <TriStateField
                label="High-vis vest"
                name="ppe-highVis"
                value={checklist.ppe.highVis}
                disabled={!editable || saving}
                onChange={(highVis) =>
                  setTri(
                    'ppe.highVis',
                    (c, v) => ({ ...c, ppe: { ...c.ppe, highVis: v } }),
                    highVis,
                  )
                }
                error={fieldErrors['ppe.highVis']}
              />
              {editable && issueDrafts['ppe.highVis'] && (
                <IssueCapturePanel
                  draft={issueDrafts['ppe.highVis']}
                  disabled={saving}
                  onChange={(d) => {
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                    clearFieldError('issue.ppe.highVis.description')
                    clearFieldError('issue.ppe.highVis.severity')
                    clearFieldError('issue.ppe.highVis.immediate_action')
                  }}
                  errors={issueFieldErrors('ppe.highVis')}
                  photoUpload={issuePhotoUploadFor('ppe.highVis')}
                />
              )}
              <TriStateField
                label="Appropriate footwear"
                name="ppe-footwear"
                value={checklist.ppe.footwear}
                disabled={!editable || saving}
                onChange={(footwear) =>
                  setTri(
                    'ppe.footwear',
                    (c, v) => ({ ...c, ppe: { ...c.ppe, footwear: v } }),
                    footwear,
                  )
                }
                error={fieldErrors['ppe.footwear']}
              />
              {editable && issueDrafts['ppe.footwear'] && (
                <IssueCapturePanel
                  draft={issueDrafts['ppe.footwear']}
                  disabled={saving}
                  onChange={(d) => {
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                    clearFieldError('issue.ppe.footwear.description')
                    clearFieldError('issue.ppe.footwear.severity')
                    clearFieldError('issue.ppe.footwear.immediate_action')
                  }}
                  errors={issueFieldErrors('ppe.footwear')}
                  photoUpload={issuePhotoUploadFor('ppe.footwear')}
                />
              )}
              <TriStateField
                label="Eye protection (when required)"
                name="ppe-eye"
                value={checklist.ppe.eyeProtection}
                disabled={!editable || saving}
                onChange={(eyeProtection) =>
                  setTri(
                    'ppe.eyeProtection',
                    (c, v) => ({
                      ...c,
                      ppe: { ...c.ppe, eyeProtection: v },
                    }),
                    eyeProtection,
                  )
                }
                error={fieldErrors['ppe.eyeProtection']}
              />
              {editable && issueDrafts['ppe.eyeProtection'] && (
                <IssueCapturePanel
                  draft={issueDrafts['ppe.eyeProtection']}
                  disabled={saving}
                  onChange={(d) => {
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                    clearFieldError('issue.ppe.eyeProtection.description')
                    clearFieldError('issue.ppe.eyeProtection.severity')
                    clearFieldError('issue.ppe.eyeProtection.immediate_action')
                  }}
                  errors={issueFieldErrors('ppe.eyeProtection')}
                  photoUpload={issuePhotoUploadFor('ppe.eyeProtection')}
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
                    'fallProtection.edgesProtected',
                    (c, v) => ({
                      ...c,
                      fallProtection: { ...c.fallProtection, edgesProtected: v },
                    }),
                    edgesProtected,
                  )
                }
                error={fieldErrors['fallProtection.edgesProtected']}
              />
              {editable && issueDrafts['fallProtection.edgesProtected'] && (
                <IssueCapturePanel
                  draft={issueDrafts['fallProtection.edgesProtected']}
                  disabled={saving}
                  onChange={(d) => {
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                    clearFieldError('issue.fallProtection.edgesProtected.description')
                    clearFieldError('issue.fallProtection.edgesProtected.severity')
                    clearFieldError('issue.fallProtection.edgesProtected.immediate_action')
                  }}
                  errors={issueFieldErrors('fallProtection.edgesProtected')}
                  photoUpload={issuePhotoUploadFor('fallProtection.edgesProtected')}
                />
              )}
              <TriStateField
                label="Fall protection in use"
                name="fp-inuse"
                value={checklist.fallProtection.fpInUse}
                disabled={!editable || saving}
                onChange={(fpInUse) =>
                  setTri(
                    'fallProtection.fpInUse',
                    (c, v) => ({
                      ...c,
                      fallProtection: { ...c.fallProtection, fpInUse: v },
                    }),
                    fpInUse,
                  )
                }
                error={fieldErrors['fallProtection.fpInUse']}
              />
              {editable && issueDrafts['fallProtection.fpInUse'] && (
                <IssueCapturePanel
                  draft={issueDrafts['fallProtection.fpInUse']}
                  disabled={saving}
                  onChange={(d) => {
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                    clearFieldError('issue.fallProtection.fpInUse.description')
                    clearFieldError('issue.fallProtection.fpInUse.severity')
                    clearFieldError('issue.fallProtection.fpInUse.immediate_action')
                  }}
                  errors={issueFieldErrors('fallProtection.fpInUse')}
                  photoUpload={issuePhotoUploadFor('fallProtection.fpInUse')}
                />
              )}
              <TriStateField
                label="Ladders / access safe"
                name="fp-ladders"
                value={checklist.fallProtection.ladders}
                disabled={!editable || saving}
                onChange={(ladders) =>
                  setTri(
                    'fallProtection.ladders',
                    (c, v) => ({
                      ...c,
                      fallProtection: { ...c.fallProtection, ladders: v },
                    }),
                    ladders,
                  )
                }
                error={fieldErrors['fallProtection.ladders']}
              />
              {editable && issueDrafts['fallProtection.ladders'] && (
                <IssueCapturePanel
                  draft={issueDrafts['fallProtection.ladders']}
                  disabled={saving}
                  onChange={(d) => {
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                    clearFieldError('issue.fallProtection.ladders.description')
                    clearFieldError('issue.fallProtection.ladders.severity')
                    clearFieldError('issue.fallProtection.ladders.immediate_action')
                  }}
                  errors={issueFieldErrors('fallProtection.ladders')}
                  photoUpload={issuePhotoUploadFor('fallProtection.ladders')}
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
                    'toolsAndWorkArea.toolsCondition',
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
                error={fieldErrors['toolsAndWorkArea.toolsCondition']}
              />
              {editable && issueDrafts['toolsAndWorkArea.toolsCondition'] && (
                <IssueCapturePanel
                  draft={issueDrafts['toolsAndWorkArea.toolsCondition']}
                  disabled={saving}
                  onChange={(d) => {
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                    clearFieldError('issue.toolsAndWorkArea.toolsCondition.description')
                    clearFieldError('issue.toolsAndWorkArea.toolsCondition.severity')
                    clearFieldError('issue.toolsAndWorkArea.toolsCondition.immediate_action')
                  }}
                  errors={issueFieldErrors('toolsAndWorkArea.toolsCondition')}
                  photoUpload={issuePhotoUploadFor('toolsAndWorkArea.toolsCondition')}
                />
              )}
              <TriStateField
                label="Work area clear"
                name="tools-clear"
                value={checklist.toolsAndWorkArea.workAreaClear}
                disabled={!editable || saving}
                onChange={(workAreaClear) =>
                  setTri(
                    'toolsAndWorkArea.workAreaClear',
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
                error={fieldErrors['toolsAndWorkArea.workAreaClear']}
              />
              {editable && issueDrafts['toolsAndWorkArea.workAreaClear'] && (
                <IssueCapturePanel
                  draft={issueDrafts['toolsAndWorkArea.workAreaClear']}
                  disabled={saving}
                  onChange={(d) => {
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                    clearFieldError('issue.toolsAndWorkArea.workAreaClear.description')
                    clearFieldError('issue.toolsAndWorkArea.workAreaClear.severity')
                    clearFieldError('issue.toolsAndWorkArea.workAreaClear.immediate_action')
                  }}
                  errors={issueFieldErrors('toolsAndWorkArea.workAreaClear')}
                  photoUpload={issuePhotoUploadFor('toolsAndWorkArea.workAreaClear')}
                />
              )}
              <TriStateField
                label="Housekeeping acceptable"
                name="tools-housekeeping"
                value={checklist.toolsAndWorkArea.housekeeping}
                disabled={!editable || saving}
                onChange={(housekeeping) =>
                  setTri(
                    'toolsAndWorkArea.housekeeping',
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
                error={fieldErrors['toolsAndWorkArea.housekeeping']}
              />
              {editable && issueDrafts['toolsAndWorkArea.housekeeping'] && (
                <IssueCapturePanel
                  draft={issueDrafts['toolsAndWorkArea.housekeeping']}
                  disabled={saving}
                  onChange={(d) => {
                    setIssueDrafts((prev) => ({ ...prev, [d.checklist_item_key]: d }))
                    clearFieldError('issue.toolsAndWorkArea.housekeeping.description')
                    clearFieldError('issue.toolsAndWorkArea.housekeeping.severity')
                    clearFieldError('issue.toolsAndWorkArea.housekeeping.immediate_action')
                  }}
                  errors={issueFieldErrors('toolsAndWorkArea.housekeeping')}
                  photoUpload={issuePhotoUploadFor('toolsAndWorkArea.housekeeping')}
                />
              )}
            </section>

            <section className="check-section" aria-labelledby="hazards-heading">
              <h3 id="hazards-heading" className="check-section__title">
                Hazards
              </h3>
              <fieldset
                className={`yesno-field${fieldErrors['hazards.present'] ? ' is-invalid' : ''}`}
                disabled={!editable || saving}
                aria-invalid={fieldErrors['hazards.present'] ? true : undefined}
              >
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
                        onChange={() => {
                          clearFieldError('hazards.present')
                          clearFieldError('hazards.description')
                          clearFieldError('hazards.severity')
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
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {fieldErrors['hazards.present'] && (
                  <span className="field-error" role="alert">
                    {fieldErrors['hazards.present']}
                  </span>
                )}
              </fieldset>

              {checklist.hazards.present && (
                <>
                  <label className="safety-form__field">
                    <span>Hazard description *</span>
                    <textarea
                      className={`safety-form__control safety-form__textarea${fieldErrors['hazards.description'] ? ' is-invalid' : ''}`}
                      rows={3}
                      disabled={!editable || saving}
                      aria-invalid={
                        fieldErrors['hazards.description'] ? true : undefined
                      }
                      value={checklist.hazards.description}
                      onChange={(e) => {
                        const description = e.target.value
                        clearFieldError('hazards.description')
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
                    {fieldErrors['hazards.description'] && (
                      <span className="field-error" role="alert">
                        {fieldErrors['hazards.description']}
                      </span>
                    )}
                  </label>
                  <label className="safety-form__field">
                    <span>Severity *</span>
                    <select
                      className={`safety-form__control touch-target${fieldErrors['hazards.severity'] ? ' is-invalid' : ''}`}
                      disabled={!editable || saving}
                      aria-invalid={
                        fieldErrors['hazards.severity'] ? true : undefined
                      }
                      value={checklist.hazards.severity ?? ''}
                      onChange={(e) => {
                        const severity = e.target.value as HazardSeverity
                        clearFieldError('hazards.severity')
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
                    {fieldErrors['hazards.severity'] && (
                      <span className="field-error" role="alert">
                        {fieldErrors['hazards.severity']}
                      </span>
                    )}
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
                          className={`safety-form__control safety-form__textarea${fieldErrors['issue.hazards.immediate_action'] ? ' is-invalid' : ''}`}
                          rows={2}
                          disabled={saving}
                          aria-invalid={
                            fieldErrors['issue.hazards.immediate_action']
                              ? true
                              : undefined
                          }
                          value={issueDrafts.hazards.immediate_action}
                          onChange={(e) => {
                            clearFieldError('issue.hazards.immediate_action')
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
                          }}
                          placeholder="What did the crew do right away?"
                        />
                        {fieldErrors['issue.hazards.immediate_action'] && (
                          <span className="field-error" role="alert">
                            {fieldErrors['issue.hazards.immediate_action']}
                          </span>
                        )}
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
              <fieldset
                className={`yesno-field${fieldErrors['incidentOrNearMiss.occurred'] ? ' is-invalid' : ''}`}
                disabled={!editable || saving}
                aria-invalid={
                  fieldErrors['incidentOrNearMiss.occurred'] ? true : undefined
                }
              >
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
                        onChange={() => {
                          clearFieldError('incidentOrNearMiss.occurred')
                          clearFieldError('incidentOrNearMiss.detail')
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
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {fieldErrors['incidentOrNearMiss.occurred'] && (
                  <span className="field-error" role="alert">
                    {fieldErrors['incidentOrNearMiss.occurred']}
                  </span>
                )}
              </fieldset>
              {checklist.incidentOrNearMiss.occurred && (
                <>
                  <label className="safety-form__field">
                    <span>Details *</span>
                    <textarea
                      className={`safety-form__control safety-form__textarea${fieldErrors['incidentOrNearMiss.detail'] ? ' is-invalid' : ''}`}
                      rows={3}
                      disabled={!editable || saving}
                      aria-invalid={
                        fieldErrors['incidentOrNearMiss.detail']
                          ? true
                          : undefined
                      }
                      value={checklist.incidentOrNearMiss.detail}
                      onChange={(e) => {
                        const detail = e.target.value
                        clearFieldError('incidentOrNearMiss.detail')
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
                    {fieldErrors['incidentOrNearMiss.detail'] && (
                      <span className="field-error" role="alert">
                        {fieldErrors['incidentOrNearMiss.detail']}
                      </span>
                    )}
                  </label>
                  {editable && issueDrafts.incidentOrNearMiss && (
                    <>
                      <label className="safety-form__field">
                        <span>Immediate action *</span>
                        <textarea
                          className={`safety-form__control safety-form__textarea${fieldErrors['issue.incidentOrNearMiss.immediate_action'] ? ' is-invalid' : ''}`}
                          rows={2}
                          disabled={saving}
                          aria-invalid={
                            fieldErrors[
                              'issue.incidentOrNearMiss.immediate_action'
                            ]
                              ? true
                              : undefined
                          }
                          value={
                            issueDrafts.incidentOrNearMiss.immediate_action
                          }
                          onChange={(e) => {
                            clearFieldError(
                              'issue.incidentOrNearMiss.immediate_action',
                            )
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
                          }}
                          placeholder="What did the crew do right away?"
                        />
                        {fieldErrors[
                          'issue.incidentOrNearMiss.immediate_action'
                        ] && (
                          <span className="field-error" role="alert">
                            {
                              fieldErrors[
                                'issue.incidentOrNearMiss.immediate_action'
                              ]
                            }
                          </span>
                        )}
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
                  data-testid="save-draft"
                  onClick={(e) => void onSaveDraft(e)}
                >
                  <Save size={20} strokeWidth={2.5} aria-hidden />
                  {saving && persistMode === 'draft'
                    ? 'Saving…'
                    : isAdmin
                      ? 'Save'
                      : 'Save draft'}
                </button>
                {!isAdmin && (
                  <button
                    type="button"
                    className="btn btn--primary touch-target"
                    disabled={saving}
                    data-testid="submit-safety-check"
                    onClick={() => void onSubmitSafetyCheck()}
                  >
                    <Send size={20} strokeWidth={2.5} aria-hidden />
                    {saving && persistMode === 'submit'
                      ? 'Submitting…'
                      : 'Submit Safety Check'}
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
                  allowMarkComplete={audience === 'framer'}
                  onChanged={() => {
                    if (!submissionId) return
                    void (async () => {
                      setIssuesLoading(true)
                      const refreshed =
                        await listIssuesForSubmission(submissionId)
                      setIssuesLoading(false)
                      if (!refreshed.error) setSavedIssues(refreshed.data)
                    })()
                  }}
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
