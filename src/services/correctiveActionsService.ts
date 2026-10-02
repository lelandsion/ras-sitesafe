import { supabase } from '../lib/supabase'
import type {
  CorrectiveAction,
  CorrectiveActionPriority,
  CorrectiveActionStatus,
} from '../types/correctiveActions'
import { humanizeDbError } from './sitesService'

const CA_SELECT =
  'id, safety_issue_id, required_action, priority, status, assignee_id, due_date, resolution_notes, resolved_by, resolved_at, created_by, created_at, updated_at'

export async function createCorrectiveAction(input: {
  safety_issue_id: string
  required_action: string
  priority: CorrectiveActionPriority
  assignee_id?: string | null
  due_date?: string | null
  created_by: string
}): Promise<{ data: CorrectiveAction | null; error: string | null }> {
  const required_action = input.required_action.trim()
  if (!required_action) {
    return { data: null, error: 'Required action is required.' }
  }

  const { data, error } = await supabase
    .from('corrective_actions')
    .insert({
      safety_issue_id: input.safety_issue_id,
      required_action,
      priority: input.priority,
      status: 'open' satisfies CorrectiveActionStatus,
      assignee_id: input.assignee_id ?? null,
      due_date: input.due_date || null,
      created_by: input.created_by,
    })
    .select(CA_SELECT)
    .single()

  if (error) {
    return { data: null, error: humanizeDbError(error.message) }
  }

  return { data: data as CorrectiveAction, error: null }
}

export async function setCorrectiveActionStatus(input: {
  id: string
  status: Extract<CorrectiveActionStatus, 'open' | 'in_progress'>
}): Promise<{ data: CorrectiveAction | null; error: string | null }> {
  const { data, error } = await supabase
    .from('corrective_actions')
    .update({
      status: input.status,
      resolution_notes: null,
      resolved_by: null,
      resolved_at: null,
    })
    .eq('id', input.id)
    .select(CA_SELECT)
    .single()

  if (error) {
    return { data: null, error: humanizeDbError(error.message) }
  }

  return { data: data as CorrectiveAction, error: null }
}

export async function resolveCorrectiveAction(input: {
  id: string
  resolution_notes: string
  resolved_by: string
}): Promise<{ data: CorrectiveAction | null; error: string | null }> {
  const notes = input.resolution_notes.trim()
  if (!notes) {
    return { data: null, error: 'Resolution notes are required.' }
  }

  const { data, error } = await supabase
    .from('corrective_actions')
    .update({
      status: 'resolved' satisfies CorrectiveActionStatus,
      resolution_notes: notes,
      resolved_by: input.resolved_by,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select(CA_SELECT)
    .single()

  if (error) {
    return { data: null, error: humanizeDbError(error.message) }
  }

  return { data: data as CorrectiveAction, error: null }
}

export async function updateCorrectiveActionDetails(input: {
  id: string
  required_action?: string
  priority?: CorrectiveActionPriority
  assignee_id?: string | null
  due_date?: string | null
}): Promise<{ data: CorrectiveAction | null; error: string | null }> {
  const patch: Record<string, unknown> = {}
  if (input.required_action !== undefined) {
    const t = input.required_action.trim()
    if (!t) return { data: null, error: 'Required action is required.' }
    patch.required_action = t
  }
  if (input.priority !== undefined) patch.priority = input.priority
  if (input.assignee_id !== undefined) patch.assignee_id = input.assignee_id
  if (input.due_date !== undefined) patch.due_date = input.due_date || null

  const { data, error } = await supabase
    .from('corrective_actions')
    .update(patch)
    .eq('id', input.id)
    .select(CA_SELECT)
    .single()

  if (error) {
    return { data: null, error: humanizeDbError(error.message) }
  }

  return { data: data as CorrectiveAction, error: null }
}
