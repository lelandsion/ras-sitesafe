import { useEffect, useId } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

type Props = {
  src: string
  alt?: string
  open: boolean
  onClose: () => void
}

export function PhotoLightbox({ src, alt = 'Photo preview', open, onClose }: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="photo-lightbox"
    >
      <button
        type="button"
        className="photo-lightbox__backdrop"
        aria-label="Close photo preview"
        onClick={onClose}
      />
      <div className="photo-lightbox__panel">
        <h2 id={titleId} className="visually-hidden">
          Zoomed photo preview
        </h2>
        <button
          type="button"
          className="photo-lightbox__close touch-target"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={22} strokeWidth={2.5} aria-hidden />
        </button>
        <img src={src} alt={alt} className="photo-lightbox__img" />
      </div>
    </div>,
    document.body,
  )
}
