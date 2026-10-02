import { useEffect, useId, useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
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
  triggerLabel?: string
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
        <img src={url} alt="Submission photo" className="photo-grid__img" />
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
  triggerLabel = 'Add photos',
}: Props) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const attachBlocked = Boolean(blockedHint)
  const pickerDisabled = Boolean(disabled || busy || attachBlocked)

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList?.length || disabled || attachBlocked) return
    setError(null)
    setBusy(true)

    let targetSubmissionId = submissionId
    if (!targetSubmissionId) {
      if (!ensureSubmissionId) {
        setError('Save the report before attaching photos.')
        setBusy(false)
        return
      }
      targetSubmissionId = await ensureSubmissionId()
      if (!targetSubmissionId) {
        setBusy(false)
        return
      }
    }

    const next = [...photos]
    for (const file of Array.from(fileList)) {
      const localError = validatePhotoFile(file)
      if (localError) {
        setError(localError)
        continue
      }
      const { data, error: uploadError } = await uploadSubmissionPhoto({
        userId,
        submissionId: targetSubmissionId,
        file,
      })
      if (uploadError || !data) {
        setError(uploadError ?? 'Upload failed.')
        continue
      }
      next.push(data)
    }

    onChange(next)
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
    onChange(photos.filter((p) => p.id !== photo.id))
    setBusy(false)
  }

  const maxMb = Math.round(PHOTO_MAX_BYTES / (1024 * 1024))

  return (
    <div className="photo-upload">
      <div className="photo-upload__header">
        <h3 className="photo-upload__title">{title}</h3>
        <p className="photo-upload__hint">
          JPEG, PNG, or WebP · max {maxMb} MB each
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
            capture="environment"
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
