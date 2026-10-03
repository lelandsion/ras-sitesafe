import { supabase } from '../lib/supabase'
import type { IssueDraft } from '../lib/safetyIssueKeys'
import type {
  CorrectiveAction,
  SafetyIssue,
  SafetyIssueWithDetails,
} from '../types/correctiveActions'
import { humanizeDbError } from './sitesService'

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
 */
export async function syncSafetyIssuesForSubmission(params: {
  submissionId: string
  createdBy: string
  drafts: Record<string, IssueDraft>
}): Promise<{ error: string | null }> {
  const { submissionId, createdBy, drafts } = params
  const keys = Object.keys(drafts)

  const existing = await supabase
    .from('safety_issues')
    .select('id, checklist_item_key')
    .eq('submission_id', submissionId)

  if (existing.error) {
    return { error: humanizeDbError(existing.error.message) }
  }

  const existingRows = existing.data ?? []
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

  const { error: upsertError } = await supabase
    .from('safety_issues')
    .upsert(rows, { onConflict: 'submission_id,checklist_item_key' })
    .select('id, checklist_item_key')

  if (upsertError) {
    return { error: humanizeDbError(upsertError.message) }
  }

  return { error: null }
}
