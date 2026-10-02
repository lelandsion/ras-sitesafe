import { supabase } from '../lib/supabase'
import {
  PHOTO_ALLOWED_TYPES,
  PHOTO_BUCKET,
  PHOTO_MAX_BYTES,
  type PhotoContentType,
  type SubmissionPhoto,
} from '../types/database'
import { humanizeDbError } from './sitesService'

export const PHOTO_FILE_ACCEPT = PHOTO_ALLOWED_TYPES.join(',')

export function validatePhotoFile(file: File): string | null {
  if (!PHOTO_ALLOWED_TYPES.includes(file.type as PhotoContentType)) {
    return 'Photos must be JPEG, PNG, or WebP.'
  }
  if (file.size <= 0) {
    return 'That file looks empty.'
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return `Photo must be under ${Math.round(PHOTO_MAX_BYTES / (1024 * 1024))} MB.`
  }
  return null
}

function extensionForType(type: PhotoContentType): string {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

function buildStoragePath(
  userId: string,
  submissionId: string,
  file: File,
): string {
  const ext = extensionForType(file.type as PhotoContentType)
  const safeBase = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40)
  const stamp = Date.now()
  return `${userId}/${submissionId}/${stamp}-${safeBase || 'photo'}.${ext}`
}

export async function listSubmissionPhotos(
  submissionId: string,
): Promise<{ data: SubmissionPhoto[]; error: string | null }> {
  const { data, error } = await supabase
    .from('submission_photos')
    .select('id, submission_id, storage_path, content_type, byte_size, created_at')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true })

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  return { data: (data ?? []) as SubmissionPhoto[], error: null }
}

export async function uploadSubmissionPhoto(params: {
  userId: string
  submissionId: string
  file: File
}): Promise<{ data: SubmissionPhoto | null; error: string | null }> {
  const validation = validatePhotoFile(params.file)
  if (validation) {
    return { data: null, error: validation }
  }

  const contentType = params.file.type as PhotoContentType
  const storagePath = buildStoragePath(
    params.userId,
    params.submissionId,
    params.file,
  )

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, params.file, {
      contentType,
      upsert: false,
    })

  if (uploadError) {
    return { data: null, error: humanizeDbError(uploadError.message) }
  }

  const { data, error } = await supabase
    .from('submission_photos')
    .insert({
      submission_id: params.submissionId,
      storage_path: storagePath,
      content_type: contentType,
      byte_size: params.file.size,
    })
    .select('id, submission_id, storage_path, content_type, byte_size, created_at')
    .single()

  if (error) {
    // Best-effort cleanup if metadata insert fails after storage write
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePath])
    return { data: null, error: humanizeDbError(error.message) }
  }

  return { data: data as SubmissionPhoto, error: null }
}

export async function deleteSubmissionPhoto(
  photo: SubmissionPhoto,
): Promise<{ error: string | null }> {
  const { error: rowError } = await supabase
    .from('submission_photos')
    .delete()
    .eq('id', photo.id)

  if (rowError) {
    return { error: humanizeDbError(rowError.message) }
  }

  const { error: storageError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .remove([photo.storage_path])

  if (storageError) {
    console.warn('[RAS SiteSafe] storage remove failed:', storageError.message)
  }

  return { error: null }
}

/** Short-lived signed URL for private bucket preview. */
export async function getPhotoSignedUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    return { url: null, error: humanizeDbError(error.message) }
  }

  return { url: data.signedUrl, error: null }
}
