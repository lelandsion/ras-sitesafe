import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Search, UserMinus, UserPlus, X } from 'lucide-react'
import {
  assignFramerToSite,
  filterFramerDirectory,
  listFramersForAdmin,
  listSiteAssignments,
  removeSiteAssignment,
} from '../../services/sitesService'
import type {
  FramerDirectoryEntry,
  SiteAssignmentWithFramer,
} from '../../types/database'

type Props = {
  open: boolean
  siteId: string | null
  siteName: string
  onClose: () => void
  onAssignmentsChanged: () => void
}

export function AssignWorkersModal({
  open,
  siteId,
  siteName,
  onClose,
  onAssignmentsChanged,
}: Props) {
  const titleId = useId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<SiteAssignmentWithFramer[]>([])
  const [framers, setFramers] = useState<FramerDirectoryEntry[]>([])
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    setError(null)
    setActionError(null)

    const [assignResult, framerResult] = await Promise.all([
      listSiteAssignments(siteId),
      listFramersForAdmin(),
    ])

    if (assignResult.error) {
      setError(assignResult.error)
      setAssignments([])
    } else {
      setAssignments(assignResult.data)
    }

    if (framerResult.error) {
      setError((prev) => prev ?? framerResult.error)
      setFramers([])
    } else {
      setFramers(framerResult.data)
    }

    setLoading(false)
  }, [siteId])

  useEffect(() => {
    if (!open || !siteId) return
    setQuery('')
    void load()
  }, [open, siteId, load])

  const assignedIds = useMemo(
    () => new Set(assignments.map((a) => a.framer_id)),
    [assignments],
  )

  const searchResults = useMemo(
    () => filterFramerDirectory(framers, query, assignedIds),
    [framers, query, assignedIds],
  )

  if (!open || !siteId) return null

  async function onAdd(framer: FramerDirectoryEntry) {
    setBusyId(framer.id)
    setActionError(null)
    const { error: addError } = await assignFramerToSite(siteId!, framer.id)
    if (addError) {
      setActionError(addError)
      setBusyId(null)
      return
    }
    await load()
    onAssignmentsChanged()
    setBusyId(null)
  }

  async function onRemove(assignmentId: string) {
    setBusyId(assignmentId)
    setActionError(null)
    const { error: removeError } = await removeSiteAssignment(assignmentId)
    if (removeError) {
      setActionError(removeError)
      setBusyId(null)
      return
    }
    await load()
    onAssignmentsChanged()
    setBusyId(null)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-panel__head">
          <div>
            <h3 id={titleId} className="modal-panel__title">
              Assign framers
            </h3>
            <p className="modal-panel__subtitle">{siteName}</p>
          </div>
          <button
            type="button"
            className="modal-panel__close touch-target"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={22} strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        {loading && (
          <div className="panel-state" role="status">
            Loading workers…
          </div>
        )}

        {!loading && error && (
          <div className="panel-state panel-state--error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn--ghost touch-target"
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {actionError && (
              <p className="form-banner form-banner--error" role="alert">
                {actionError}
              </p>
            )}

            <section className="assign-section" aria-labelledby="assign-current">
              <h4 id="assign-current" className="assign-section__title">
                Assigned ({assignments.length})
              </h4>
              {assignments.length === 0 ? (
                <p className="assign-section__empty">
                  No framers assigned yet. Search below to add workers.
                </p>
              ) : (
                <ul className="assign-list">
                  {assignments.map((row) => (
                    <li key={row.id} className="assign-row">
                      <div>
                        <p className="assign-row__name">
                          {row.framer?.display_name ?? 'Unknown framer'}
                        </p>
                        <p className="assign-row__meta">
                          Since{' '}
                          {new Intl.DateTimeFormat(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }).format(new Date(row.assigned_at))}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn--danger-ghost touch-target"
                        disabled={busyId === row.id}
                        onClick={() => void onRemove(row.id)}
                      >
                        <UserMinus size={20} strokeWidth={2.25} aria-hidden />
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="assign-section" aria-labelledby="assign-search">
              <h4 id="assign-search" className="assign-section__title">
                Add framer
              </h4>
              <label className="field field--search">
                <span className="visually-hidden">Search framers</span>
                <Search size={20} strokeWidth={2.25} aria-hidden />
                <input
                  className="field__input touch-target"
                  type="search"
                  placeholder="Search by name or email"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />
              </label>
              {searchResults.length === 0 ? (
                <p className="assign-section__empty">
                  {framers.length === 0
                    ? 'No framer profiles found. Seed demo users in Supabase first.'
                    : 'No matches — try another name or email.'}
                </p>
              ) : (
                <ul className="assign-list assign-list--pick">
                  {searchResults.slice(0, 8).map((framer) => (
                    <li key={framer.id} className="assign-row">
                      <div>
                        <p className="assign-row__name">{framer.display_name}</p>
                        <p className="assign-row__meta">{framer.email}</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn--primary touch-target"
                        disabled={busyId === framer.id}
                        onClick={() => void onAdd(framer)}
                      >
                        <UserPlus size={20} strokeWidth={2.25} aria-hidden />
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <div className="modal-panel__actions modal-panel__actions--end">
          <button
            type="button"
            className="btn btn--ghost touch-target"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
