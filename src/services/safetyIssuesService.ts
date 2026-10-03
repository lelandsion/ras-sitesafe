import { supabase } from '../lib/supabase'
import {
  issuePhotoCaptureAllowed,
  type IssueDraft,
} from '../lib/safetyIssueKeys'
import { PHOTO_BUCKET, type PhotoContentType } from '../types/database'
import type {
  CorrectiveAction,
  SafetyIssue,
  SafetyIssueWithDetails,
} from '../types/correctiveActions'
import { humanizeDbError } from './sitesService'
import { resolvePhotoContentType, validatePhotoFile } from './photosService'

function normalizeEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapIssueRow(row: Record<string, unknown>): SafetyIssueWithDetails {
  const {
    submission,
    corrective_actions,
    ...rest
  } = row
  const sub = normalizeEmbed(
    submission as SafetyIssueWithDetails['submission'] | SafetyIssueWithDetails['submission'][] | null,
  )
  let mappedSub: SafetyIssueWithDetails['submission'] = null
  if (sub) {
    const sites = normalizeEmbed(
      (sub as { sites?: unknown }).sites as
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null,
    )
    const submitter = normalizeEmbed(
      (sub as { submitter?: unknown }).submitter as
        | { id: string; display_name: string }
        | { id: string; display_name: string }[]
        | null,
    )
    mappedSub = {
      ...(sub as NonNullable<SafetyIssueWithDetails['submission']>),
      sites,
      submitter,
    }
  }

  const cas = corrective_actions as CorrectiveAction[] | CorrectiveAction | null | undefined
  const caList = Array.isArray(cas) ? cas : cas ? [cas] : []
  // Prefer newest CA
  const corrective_action =
    caList.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0] ?? null

  return {
    ...(rest as unknown as SafetyIssue),
    submission: mappedSub,
    corrective_action,
  }
}

export async function listIssuesForSubmission(
  submissionId: string,
): Promise<{ data: SafetyIssueWithDetails[]; error: string | null }> {
  const { data, error } = await supabase
    .from('safety_issues')
    .select(
      `
      id,
      submission_id,
      checklist_item_key,
      item_label,
      description,
      severity,
      immediate_action,
      created_by,
      created_at,
      updated_at,
      corrective_actions (
        id,
        safety_issue_id,
        required_action,
        priority,
        status,
        assignee_id,
        due_date,
        resolution_notes,
        resolved_by,
        resolved_at,
        created_by,
        created_at,
        updated_at
      )
    `,
    )
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true })

  if (error) {
    if (
      error.message.includes('safety_issues') ||
      error.message.includes('schema cache') ||
      error.message.includes('PGRST205')
    ) {
      return { data: [], error: null }
    }
    return { data: [], error: humanizeDbError(error.message) }
  }

  return {
    data: (data ?? []).map((row) => mapIssueRow(row as Record<string, unknown>)),
    error: null,
  }
}

export async function listAdminSafetyIssues(): Promise<{
  data: SafetyIssueWithDetails[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('safety_issues')
    .select(
      `
      id,
      submission_id,
      checklist_item_key,
      item_label,
      description,
      severity,
      immediate_action,
      created_by,
      created_at,
      updated_at,
      submission:submissions!safety_issues_submission_id_fkey (
        id,
        site_id,
        submitted_by,
        status,
        created_at,
        sites ( id, name ),
        submitter:profiles!submissions_submitted_by_fkey ( id, display_name )
      ),
      corrective_actions (
        id,
        safety_issue_id,
        required_action,
        priority,
        status,
        assignee_id,
        due_date,
        resolution_notes,
        resolved_by,
        resolved_at,
        created_by,
        created_at,
        updated_at
      )
    `,
    )
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: humanizeDbError(error.message) }
  }

  return {
    data: (data ?? []).map((row) => mapIssueRow(row as Record<string, unknown>)),
    error: null,
  }
}

/**
 * Upsert field issues for a submission and delete obsolete keys.
 * Unique (submission_id, checklist_item_key) prevents duplicates on re-save.
 * Set `pruneMissing: false` for draft saves so incomplete capture is not wiped.
 */
export async function syncSafetyIssuesForSubmission(params: {
  submissionId: string
  createdBy: string
  drafts: Record<string, IssueDraft>
  pruneMissing?: boolean
}): Promise<{ error: string | null }> {
  const { submissionId, createdBy, drafts, pruneMissing = true } = params
  const keys = Object.keys(drafts)

  const existing = await supabase
    .from('safety_issues')
    .select('id, checklist_item_key')
    .eq('submission_id', submissionId)

  if (existing.error) {
    return { error: humanizeDbError(existing.error.message) }
  }

  const existingRows = existing.data ?? []
  if (pruneMissing) {
    const keep = new Set(keys)
    const toDelete = existingRows
      .filter((r) => !keep.has(r.checklist_item_key))
      .map((r) => r.id)

    if (toDelete.length > 0) {
      const { error: delError } = await supabase
        .from('safety_issues')
        .delete()
        .in('id', toDelete)
      if (delError) {
        return { error: humanizeDbError(delError.message) }
      }
    }
  }

  if (keys.length === 0) {
    return { error: null }
  }

  const rows = keys.map((key) => {
    const d = drafts[key]
    return {
      submission_id: submissionId,
      checklist_item_key: d.checklist_item_key,
      item_label: d.item_label,
      description: d.description.trim(),
      severity: d.severity!,
      immediate_action: d.immediate_action.trim(),
      created_by: createdBy,
    }
  })

  const { data: upserted, error: upsertError } = await supabase
    .from('safety_issues')
    .upsert(rows, { onConflict: 'submission_id,checklist_item_key' })
    .select('id, checklist_item_key')

  if (upsertError) {
    return { error: humanizeDbError(upsertError.message) }
  }

  // Optional pending photos — checklist failures only (photo_kind: issue).
  for (const row of upserted ?? []) {
    const draft = drafts[row.checklist_item_key]
    if (!draft || !issuePhotoCaptureAllowed(draft.checklist_item_key)) continue
    const file = draft.pendingPhoto
    if (!file) continue
    const validation = validatePhotoFile(file)
    if (validation) continue
    const contentType = resolvePhotoContentType(file)
    if (!contentType) continue

    const ext =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : 'jpg'
    const storagePath = `${createdBy}/${submissionId}/issue-${row.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, file, {
        contentType,
        upsert: false,
      })
    if (uploadError) continue

    await supabase.from('submission_photos').insert({
      submission_id: submissionId,
      storage_path: storagePath,
      content_type: contentType as PhotoContentType,
      byte_size: file.size,
      photo_kind: 'issue',
      safety_issue_id: row.id,
    })
  }

  return { error: null }
}
