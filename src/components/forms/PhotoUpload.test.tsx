import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubmissionPhoto } from '../../types/database'
import { PhotoUpload } from './PhotoUpload'

const uploadSubmissionPhoto = vi.fn()
const deleteSubmissionPhoto = vi.fn()
const getPhotoSignedUrl = vi.fn()
const validatePhotoFile = vi.fn()

vi.mock('../../services/photosService', () => ({
  PHOTO_FILE_ACCEPT: 'image/jpeg,image/png,image/webp',
  uploadSubmissionPhoto: (...args: unknown[]) => uploadSubmissionPhoto(...args),
  deleteSubmissionPhoto: (...args: unknown[]) => deleteSubmissionPhoto(...args),
  getPhotoSignedUrl: (...args: unknown[]) => getPhotoSignedUrl(...args),
  validatePhotoFile: (...args: unknown[]) => validatePhotoFile(...args),
}))

function fakePhoto(id: string): SubmissionPhoto {
  return {
    id,
    submission_id: 'sub-1',
    storage_path: `u/sub-1/${id}.jpg`,
    content_type: 'image/jpeg',
    byte_size: 100,
    photo_kind: 'site',
    created_at: '2026-10-02T00:00:00Z',
  }
}

describe('PhotoUpload', () => {
  beforeEach(() => {
    uploadSubmissionPhoto.mockReset()
    deleteSubmissionPhoto.mockReset()
    getPhotoSignedUrl.mockReset()
    validatePhotoFile.mockReset()
    getPhotoSignedUrl.mockResolvedValue({ url: null, error: null })
    validatePhotoFile.mockReturnValue(null)
  })

  it('omits capture so iOS can offer Photo Library / Files', () => {
    render(
      <PhotoUpload
        userId="user-1"
        submissionId="sub-1"
        photos={[]}
        onChange={vi.fn()}
        photoKind="site"
      />,
    )

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.accept).toBe('image/jpeg,image/png,image/webp')
    expect(input.hasAttribute('capture')).toBe(false)
  })

  it('auto-creates a draft then uploads on the first select', async () => {
    const user = userEvent.setup()
    const ensureSubmissionId = vi.fn().mockResolvedValue('sub-created')
    const onChange = vi.fn()
    const uploaded = fakePhoto('p1')
    uploadSubmissionPhoto.mockResolvedValue({ data: uploaded, error: null })

    render(
      <PhotoUpload
        userId="user-1"
        submissionId={null}
        ensureSubmissionId={ensureSubmissionId}
        photos={[]}
        onChange={onChange}
        photoKind="site"
        triggerLabel="Add site photo"
      />,
    )

    const file = new File([new Uint8Array([1, 2, 3])], 'site.jpg', {
      type: 'image/jpeg',
    })
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(ensureSubmissionId).toHaveBeenCalledTimes(1)
      expect(uploadSubmissionPhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          submissionId: 'sub-created',
          photoKind: 'site',
        }),
      )
      expect(onChange).toHaveBeenCalledWith([uploaded])
    })
  })

  it('does not upload when draft create fails', async () => {
    const user = userEvent.setup()
    const ensureSubmissionId = vi.fn().mockResolvedValue(null)
    const onChange = vi.fn()

    render(
      <PhotoUpload
        userId="user-1"
        submissionId={null}
        ensureSubmissionId={ensureSubmissionId}
        photos={[]}
        onChange={onChange}
        photoKind="hazard"
      />,
    )

    const file = new File([new Uint8Array([1, 2, 3])], 'h.jpg', {
      type: 'image/jpeg',
    })
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(ensureSubmissionId).toHaveBeenCalled()
    })
    expect(uploadSubmissionPhoto).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
