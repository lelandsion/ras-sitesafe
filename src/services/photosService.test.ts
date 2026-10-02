import { describe, expect, it, vi } from 'vitest'
import { PHOTO_MAX_BYTES } from '../types/database'
import { validatePhotoFile } from './photosService'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

function fakeFile(overrides: {
  name?: string
  type?: string
  size?: number
} = {}): File {
  const size = overrides.size ?? 1024
  const type = overrides.type ?? 'image/jpeg'
  const name = overrides.name ?? 'site.jpg'
  const buffer = new Uint8Array(Math.max(size, 1))
  const file = new File([buffer], name, { type })
  // jsdom File.size follows blob contents; override when we need exact sizes
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('validatePhotoFile', () => {
  it('accepts JPEG, PNG, and WebP under the size limit', () => {
    expect(validatePhotoFile(fakeFile({ type: 'image/jpeg' }))).toBeNull()
    expect(validatePhotoFile(fakeFile({ type: 'image/png' }))).toBeNull()
    expect(validatePhotoFile(fakeFile({ type: 'image/webp' }))).toBeNull()
  })

  it('rejects disallowed MIME types', () => {
    expect(validatePhotoFile(fakeFile({ type: 'image/gif', name: 'x.gif' }))).toBe(
      'Photos must be JPEG, PNG, or WebP.',
    )
    expect(validatePhotoFile(fakeFile({ type: 'application/pdf', name: 'x.pdf' }))).toBe(
      'Photos must be JPEG, PNG, or WebP.',
    )
  })

  it('rejects empty files', () => {
    expect(validatePhotoFile(fakeFile({ size: 0 }))).toBe('That file looks empty.')
  })

  it('rejects files over 8 MiB', () => {
    expect(
      validatePhotoFile(fakeFile({ size: PHOTO_MAX_BYTES + 1 })),
    ).toBe('Photo must be under 8 MB.')
  })

  it('accepts a file exactly at the max size', () => {
    expect(validatePhotoFile(fakeFile({ size: PHOTO_MAX_BYTES }))).toBeNull()
  })
})
