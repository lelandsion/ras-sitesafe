import { useEffect, useState, type ReactNode } from 'react'
import { PhotoLightbox } from '../ui/PhotoLightbox'
import {
  HAZARD_SEVERITY_LABELS,
  parseDailySafetyChecklist,
  TRI_STATE_LABELS,
  type DailySafetyChecklist,
  type TriState,
} from '../../types/safetyChecklist'
import {
  SUBMISSION_PHOTO_KIND_LABELS,
  SUBMISSION_STATUS_LABELS,
  type SubmissionPhoto,
  type SubmissionPhotoKind,
  type SubmissionStatus,
} from '../../types/database'
import { getPhotoSignedUrl } from '../../services/photosService'

export type SubmissionReportMeta = {
  id: string
  status: SubmissionStatus
  notes: string | null
  checklist: unknown
  created_at: string
  updated_at: string
  siteName: string
  siteAddress?: string | null
  workerName: string
}

function triLabel(v: TriState | null): string {
  if (!v) return '—'
  return TRI_STATE_LABELS[v]
}

function ChecklistSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="report-section">
      <h3 className="report-section__title">{title}</h3>
      <div className="report-section__body">{children}</div>
    </section>
  )
}

function TriRow({ label, value }: { label: string; value: TriState | null }) {
  return (
    <p className="report-tri">
      <span className="report-tri__label">{label}</span>
      <span className="report-tri__value">{triLabel(value)}</span>
    </p>
  )
}

function ReportPhotoGrid({
  title,
  photos,
}: {
  title: string
  photos: SubmissionPhoto[]
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      const next: Record<string, string> = {}
      for (const photo of photos) {
        const { url } = await getPhotoSignedUrl(photo.storage_path)
        if (url) next[photo.id] = url
      }
      if (active) setUrls(next)
    })()
    return () => {
      active = false
    }
  }, [photos])

  if (photos.length === 0) return null

  const zoomSrc = activeId ? urls[activeId] : null

  return (
    <section className="report-section report-section--photos">
      <h3 className="report-section__title">{title}</h3>
      <ul className="report-photo-grid">
        {photos.map((photo) => (
          <li key={photo.id} className="report-photo-grid__item">
            {urls[photo.id] ? (
              <button
                type="button"
                className="report-photo-grid__zoom"
                onClick={() => setActiveId(photo.id)}
                aria-label={`View ${title} larger`}
              >
                <img
                  src={urls[photo.id]}
                  alt=""
                  className="report-photo-grid__img"
                />
              </button>
            ) : (
              <div className="report-photo-grid__placeholder" aria-hidden />
            )}
          </li>
        ))}
      </ul>
      {zoomSrc && (
        <PhotoLightbox
          src={zoomSrc}
          alt={`${title} preview`}
          open={Boolean(activeId)}
          onClose={() => setActiveId(null)}
        />
      )}
    </section>
  )
}

function renderChecklist(checklist: DailySafetyChecklist) {
  return (
    <>
      <ChecklistSection title="PPE">
        <TriRow label="Hard hat worn" value={checklist.ppe.hardHat} />
        <TriRow label="High-vis vest" value={checklist.ppe.highVis} />
        <TriRow label="Appropriate footwear" value={checklist.ppe.footwear} />
        <TriRow label="Eye protection (when required)" value={checklist.ppe.eyeProtection} />
      </ChecklistSection>

      <ChecklistSection title="Fall protection">
        <TriRow label="Edges / openings protected" value={checklist.fallProtection.edgesProtected} />
        <TriRow label="Fall protection in use" value={checklist.fallProtection.fpInUse} />
        <TriRow label="Ladders / access safe" value={checklist.fallProtection.ladders} />
      </ChecklistSection>

      <ChecklistSection title="Tools & work area">
        <TriRow label="Tools / equipment condition OK" value={checklist.toolsAndWorkArea.toolsCondition} />
        <TriRow label="Work area clear" value={checklist.toolsAndWorkArea.workAreaClear} />
        <TriRow label="Housekeeping acceptable" value={checklist.toolsAndWorkArea.housekeeping} />
      </ChecklistSection>

      <ChecklistSection title="Hazards">
        <p className="report-line">
          Hazard observed:{' '}
          {checklist.hazards.present === null
            ? '—'
            : checklist.hazards.present
              ? 'Yes'
              : 'No'}
        </p>
        {checklist.hazards.present && (
          <>
            <p className="report-line">
              <strong>Description:</strong> {checklist.hazards.description || '—'}
            </p>
            <p className="report-line">
              <strong>Severity:</strong>{' '}
              {checklist.hazards.severity
                ? HAZARD_SEVERITY_LABELS[checklist.hazards.severity]
                : '—'}
            </p>
          </>
        )}
      </ChecklistSection>

      <ChecklistSection title="Incident / near miss">
        <p className="report-line">
          Occurred:{' '}
          {checklist.incidentOrNearMiss.occurred === null
            ? '—'
            : checklist.incidentOrNearMiss.occurred
              ? 'Yes'
              : 'No'}
        </p>
        {checklist.incidentOrNearMiss.occurred && (
          <p className="report-line">
            <strong>Details:</strong> {checklist.incidentOrNearMiss.detail || '—'}
          </p>
        )}
      </ChecklistSection>
    </>
  )
}

export function SubmissionReportView({
  meta,
  photos,
  adminSummaryLines,
}: {
  meta: SubmissionReportMeta
  photos: SubmissionPhoto[]
  adminSummaryLines?: string[]
}) {
  const checklist = parseDailySafetyChecklist(
    meta.checklist,
    meta.created_at.slice(0, 10),
  )

  const byKind = (kind: SubmissionPhotoKind) =>
    photos.filter((p) => (p.photo_kind ?? 'site') === kind)

  return (
    <article className="report-document">
      <header className="report-document__header">
        <p className="report-document__brand">RAS SiteSafe</p>
        <h1 className="report-document__title">Daily Safety Check</h1>
        <dl className="report-meta">
          <div>
            <dt>Site</dt>
            <dd>
              {meta.siteName}
              {meta.siteAddress ? (
                <span className="report-meta__sub">{meta.siteAddress}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Check date</dt>
            <dd>{checklist.checkDate}</dd>
          </div>
          <div>
            <dt>Worker</dt>
            <dd>{meta.workerName}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{SUBMISSION_STATUS_LABELS[meta.status]}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(meta.updated_at).toLocaleString()}</dd>
          </div>
        </dl>
      </header>

      {adminSummaryLines && adminSummaryLines.length > 0 && (
        <ChecklistSection title="Site safety summary">
          {adminSummaryLines.map((line) => (
            <p key={line} className="report-line">
              {line}
            </p>
          ))}
        </ChecklistSection>
      )}

      {renderChecklist(checklist)}

      {meta.notes?.trim() && (
        <ChecklistSection title="Additional notes">
          <p className="report-line report-line--pre">{meta.notes.trim()}</p>
        </ChecklistSection>
      )}

      <ReportPhotoGrid
        title={SUBMISSION_PHOTO_KIND_LABELS.site}
        photos={byKind('site')}
      />
      <ReportPhotoGrid
        title={SUBMISSION_PHOTO_KIND_LABELS.hazard}
        photos={byKind('hazard')}
      />
    </article>
  )
}
