import { useEffect, useId, useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { PhotoLightbox } from '../ui/PhotoLightbox'
import {
  deleteSubmissionPhoto,
  getPhotoSignedUrl,
  PHOTO_FILE_ACCEPT,
  uploadSubmissionPhoto,
  validatePhotoFile,
} from '../../services/photosService'
import {
  PHOTO_MAX_BYTES,
  type SubmissionPhoto,
  type SubmissionPhotoKind,
} from '../../types/database'

type Props = {
  userId: string
  submissionId: string | null
  ensureSubmissionId?: () => Promise<string | null>
  photos: SubmissionPhoto[]
  onChange: (photos: SubmissionPhoto[]) => void
  disabled?: boolean
  blockedHint?: string | null
  title?: string
  /** When false, omit the inner title (parent section already labels it). */
  showTitle?: boolean
  triggerLabel?: string
  photoKind?: SubmissionPhotoKind
}

function PhotoThumb({
  photo,
  disabled,
  onRemove,
}: {
  photo: SubmissionPhoto
  disabled?: boolean
  onRemove: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    let active = true
    void getPhotoSignedUrl(photo.storage_path).then(({ url: signed }) => {
      if (active) setUrl(signed)
    })
    return () => {
      active = false
    }
  }, [photo.storage_path])

  return (
    <li className="photo-grid__item">
      {url ? (
        <button
          type="button"
          className="photo-grid__zoom"
          onClick={() => setZoomed(true)}
          aria-label="View photo larger"
        >
          <img src={url} alt="Submission photo" className="photo-grid__img" />
        </button>
      ) : (
        <div className="photo-grid__placeholder" aria-hidden>
          <Camera size={22} strokeWidth={2.25} />
        </div>
      )}
      {!disabled && (
        <button
          type="button"
          className="photo-grid__remove touch-target"
          aria-label="Remove photo"
          onClick={onRemove}
        >
          <Trash2 size={18} strokeWidth={2.5} aria-hidden />
        </button>
      )}
      {url && (
        <PhotoLightbox
          src={url}
          alt="Submission photo"
          open={zoomed}
          onClose={() => setZoomed(false)}
        />
      )}
    </li>
  )
}

export function PhotoUpload({
  userId,
  submissionId,
  ensureSubmissionId,
  photos,
  onChange,
  disabled,
  blockedHint,
  title = 'Site photos',
  showTitle = true,
  triggerLabel = 'Add photos',
  photoKind = 'site',
}: Props) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Keep latest kind-scoped list for multi-file / race-safe appends. */
  const photosRef = useRef(photos)
  photosRef.current = photos

  const attachBlocked = Boolean(blockedHint)
  const pickerDisabled = Boolean(disabled || busy || attachBlocked)

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList?.length || disabled || attachBlocked) return
    // Snapshot immediately: FileList is live. Clearing the input (so the same
    // file can be re-picked) empties it. Any await before Array.from — e.g.
    // ensureSubmissionId on first site-photo attach — then uploads nothing.
    const files = Array.from(fileList)
    setError(null)
    setBusy(true)

    let targetSubmissionId = submissionId
    if (!targetSubmissionId) {
      if (!ensureSubmissionId) {
        setError('Save the report before attaching photos.')
        setBusy(false)
        return
      }
      // Auto-create draft before first upload so FK/storage path have a row.
      targetSubmissionId = await ensureSubmissionId()
      if (!targetSubmissionId) {
        setBusy(false)
        return
      }
    }

    let next = [...photosRef.current]
    for (const file of files) {
      const localError = validatePhotoFile(file)
      if (localError) {
        setError(localError)
        continue
      }
      const { data, error: uploadError } = await uploadSubmissionPhoto({
        userId,
        submissionId: targetSubmissionId,
        file,
        photoKind,
      })
      if (uploadError || !data) {
        setError(uploadError ?? 'Upload failed.')
        continue
      }
      next = [...next, data]
      photosRef.current = next
      // Push after each file so the thumb shows immediately.
      onChange(next)
    }

    setBusy(false)
  }

  async function removePhoto(photo: SubmissionPhoto) {
    if (disabled) return
    setError(null)
    setBusy(true)
    const { error: deleteError } = await deleteSubmissionPhoto(photo)
    if (deleteError) {
      setError(deleteError)
      setBusy(false)
      return
    }
    const next = photosRef.current.filter((p) => p.id !== photo.id)
    photosRef.current = next
    onChange(next)
    setBusy(false)
  }

  const maxMb = Math.round(PHOTO_MAX_BYTES / (1024 * 1024))

  return (
    <div className="photo-upload" data-testid={`photo-upload-${photoKind}`}>
      <div className="photo-upload__header">
        {showTitle ? <h3 className="photo-upload__title">{title}</h3> : null}
        <p className="photo-upload__hint">
          JPEG, PNG, or WebP · max {maxMb} MB each
          {photoKind === 'site'
            ? ' · not tied to a hazard'
            : photoKind === 'issue'
              ? ' · optional for checklist No'
              : ''}
        </p>
      </div>

      {photos.length > 0 && (
        <ul className="photo-grid" aria-label="Uploaded photos">
          {photos.map((photo) => (
            <PhotoThumb
              key={photo.id}
              photo={photo}
              disabled={disabled || busy}
              onRemove={() => void removePhoto(photo)}
            />
          ))}
        </ul>
      )}

      {!disabled && (
        <>
          <input
            id={inputId}
            className="photo-upload__input"
            type="file"
            accept={PHOTO_FILE_ACCEPT}
            multiple
            disabled={pickerDisabled}
            onChange={(e) => {
              void onFilesSelected(e.target.files)
              e.target.value = ''
            }}
          />
          <label
            htmlFor={inputId}
            className={`btn btn--ghost touch-target photo-upload__trigger${busy ? ' is-busy' : ''}${pickerDisabled && !busy ? ' is-disabled' : ''}`}
          >
            <ImagePlus size={20} strokeWidth={2.5} aria-hidden />
            {busy ? 'Uploading…' : triggerLabel}
          </label>
          {blockedHint && (
            <p className="photo-upload__hint" role="status">
              {blockedHint}
            </p>
          )}
        </>
      )}

      {error && (
        <p className="form-banner form-banner--error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
