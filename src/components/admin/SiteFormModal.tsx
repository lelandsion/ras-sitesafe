import { useEffect, useId, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { Site } from '../../types/database'
import type { SiteUpsertInput } from '../../services/sitesService'

type Props = {
  open: boolean
  site: Site | null
  saving: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: SiteUpsertInput) => void
}

export function SiteFormModal({
  open,
  site,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const titleId = useId()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setName(site?.name ?? '')
    setAddress(site?.address ?? '')
    setIsActive(site?.is_active ?? true)
  }, [open, site])

  if (!open) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      name,
      address: address.trim() ? address : null,
      is_active: isActive,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-panel__head">
          <h3 id={titleId} className="modal-panel__title">
            {site ? 'Edit jobsite' : 'Add jobsite'}
          </h3>
          <button
            type="button"
            className="modal-panel__close touch-target"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={22} strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Site name</span>
            <input
              className="field__input touch-target"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span className="field__label">Address</span>
            <input
              className="field__input touch-target"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={240}
              autoComplete="street-address"
              placeholder="Optional"
            />
          </label>
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="field__label">Active (visible to assigned framers)</span>
          </label>

          {error && (
            <p className="form-banner form-banner--error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-panel__actions">
            <button
              type="button"
              className="btn btn--ghost touch-target"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary touch-target"
              disabled={saving}
            >
              {saving ? 'Saving…' : site ? 'Save changes' : 'Create site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
