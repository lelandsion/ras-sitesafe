import { supabase } from '../lib/supabase'
import {
  PHOTO_ALLOWED_TYPES,
  PHOTO_BUCKET,
  PHOTO_MAX_BYTES,
  type PhotoContentType,
  type SubmissionPhoto,
  type SubmissionPhotoKind,
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

function isMissingPhotoKindColumn(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('photo_kind') ||
    (m.includes('column') && m.includes('does not exist')) ||
    m.includes('schema cache')
  )
}

function withDefaultPhotoKind(
  rows: Array<Omit<SubmissionPhoto, 'photo_kind'> & { photo_kind?: SubmissionPhotoKind | null }>,
): SubmissionPhoto[] {
  return rows.map((row) => ({
    ...row,
    photo_kind: row.photo_kind ?? 'site',
  }))
}

export async function listSubmissionPhotos(
  submissionId: string,
  options?: { kind?: SubmissionPhotoKind },
): Promise<{ data: SubmissionPhoto[]; error: string | null }> {
  let query = supabase
    .from('submission_photos')
    .select(
      'id, submission_id, storage_path, content_type, byte_size, photo_kind, created_at',
    )
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true })

  if (options?.kind) {
    query = query.eq('photo_kind', options.kind)
  }

  const { data, error } = await query

  if (!error) {
    let rows = withDefaultPhotoKind((data ?? []) as SubmissionPhoto[])
    if (options?.kind) {
      rows = rows.filter((p) => (p.photo_kind ?? 'site') === options.kind)
    }
    return { data: rows, error: null }
  }

  // Part 5 not applied yet — retry without photo_kind so the form still loads.
  if (!isMissingPhotoKindColumn(error.message)) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  const legacy = await supabase
    .from('submission_photos')
    .select('id, submission_id, storage_path, content_type, byte_size, created_at')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true })

  if (legacy.error) {
    return {
      data: [],
      error:
        'Photo kind column is missing. Run Part 5 SQL (photo_kind) in Supabase, then refresh.',
    }
  }

  let rows = withDefaultPhotoKind(
    (legacy.data ?? []) as Array<
      Omit<SubmissionPhoto, 'photo_kind'> & { photo_kind?: SubmissionPhotoKind | null }
    >,
  )
  // Without photo_kind, treat legacy rows as site photos (general).
  if (options?.kind === 'hazard') {
    rows = []
  }
  return { data: rows, error: null }
}

export async function uploadSubmissionPhoto(params: {
  userId: string
  submissionId: string
  file: File
  photoKind?: SubmissionPhotoKind
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

  const photoKind = params.photoKind ?? 'site'
  const { data, error } = await supabase
    .from('submission_photos')
    .insert({
      submission_id: params.submissionId,
      storage_path: storagePath,
      content_type: contentType,
      byte_size: params.file.size,
      photo_kind: photoKind,
    })
    .select(
      'id, submission_id, storage_path, content_type, byte_size, photo_kind, created_at',
    )
    .single()

  if (!error && data) {
    return {
      data: withDefaultPhotoKind([data as SubmissionPhoto])[0] ?? null,
      error: null,
    }
  }

  if (error && isMissingPhotoKindColumn(error.message)) {
    // Allow general site uploads before Part 5; hazard kind needs the column.
    if (photoKind === 'hazard') {
      await supabase.storage.from(PHOTO_BUCKET).remove([storagePath])
      return {
        data: null,
        error:
          'Hazard photos need the photo_kind column. Run Part 5 SQL in Supabase, then try again.',
      }
    }

    const legacy = await supabase
      .from('submission_photos')
      .insert({
        submission_id: params.submissionId,
        storage_path: storagePath,
        content_type: contentType,
        byte_size: params.file.size,
      })
      .select('id, submission_id, storage_path, content_type, byte_size, created_at')
      .single()

    if (legacy.error || !legacy.data) {
      await supabase.storage.from(PHOTO_BUCKET).remove([storagePath])
      return {
        data: null,
        error:
          legacy.error?.message
            ? humanizeDbError(legacy.error.message)
            : 'Upload failed. Run Part 5 SQL (photo_kind) if photos keep failing.',
      }
    }

    return {
      data: withDefaultPhotoKind([
        legacy.data as Omit<SubmissionPhoto, 'photo_kind'> & {
          photo_kind?: SubmissionPhotoKind | null
        },
      ])[0] ?? null,
      error: null,
    }
  }

  // Best-effort cleanup if metadata insert fails after storage write
  await supabase.storage.from(PHOTO_BUCKET).remove([storagePath])
  return {
    data: null,
    error: error ? humanizeDbError(error.message) : 'Upload failed.',
  }
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
