import type { Profile, Site, Submission } from './database'

export type IssueSeverity = 'low' | 'medium' | 'high'

export type CorrectiveActionStatus =
  | 'open'
  | 'in_progress'
  | 'ready_for_review'
  | 'resolved'

export type CorrectiveActionPriority = 'low' | 'medium' | 'high'

export interface SafetyIssue {
  id: string
  submission_id: string
  checklist_item_key: string
  item_label: string
  description: string
  severity: IssueSeverity
  immediate_action: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CorrectiveAction {
  id: string
  safety_issue_id: string
  required_action: string
  priority: CorrectiveActionPriority
  status: CorrectiveActionStatus
  assignee_id: string | null
  due_date: string | null
  resolution_notes: string | null
  resolved_by: string | null
  resolved_at: string | null
  /** Set when framer marks ready for review — not a formal resolve. */
  framer_completed_at: string | null
  framer_completion_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SafetyIssueWithDetails extends SafetyIssue {
  submission: Pick<Submission, 'id' | 'site_id' | 'submitted_by' | 'status' | 'created_at'> & {
    sites: Pick<Site, 'id' | 'name'> | null
    submitter: Pick<Profile, 'id' | 'display_name'> | null
  } | null
  /** Latest CA if any (one primary CA per issue for v1 UI). */
  corrective_action: CorrectiveAction | null
}

export const ISSUE_SEVERITY_LABELS: Record<IssueSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const CA_STATUS_LABELS: Record<CorrectiveActionStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  ready_for_review: 'Ready for review',
  resolved: 'Resolved',
}

export const CA_PRIORITY_LABELS: Record<CorrectiveActionPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
