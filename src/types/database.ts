export type UserRole = 'admin' | 'framer'

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'

export interface Profile {
  id: string
  display_name: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Site {
  id: string
  name: string
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SiteWithAssignmentCount extends Site {
  assignment_count: number
}

export interface SiteAssignment {
  id: string
  site_id: string
  framer_id: string
  assigned_at: string
}

export interface SiteAssignmentWithFramer extends SiteAssignment {
  framer: Pick<Profile, 'id' | 'display_name'> | null
}

/** Admin worker search row (RPC admin_list_framers). */
export interface FramerDirectoryEntry {
  id: string
  display_name: string
  email: string
}

export interface Submission {
  id: string
  site_id: string
  submitted_by: string
  status: SubmissionStatus
  /** Daily Safety Check JSON (see safetyChecklist.ts). Legacy rows may be {}. */
  checklist: Record<string, unknown>
  notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface SubmissionPhoto {
  id: string
  submission_id: string
  storage_path: string
  content_type: 'image/jpeg' | 'image/png' | 'image/webp'
  byte_size: number | null
  created_at: string
}

/** Submission row with joined site name for list/detail UI. */
export interface SubmissionWithSite extends Submission {
  sites: Pick<Site, 'id' | 'name' | 'address'> | null
}

/** Admin list row: site + submitter profile. */
export interface SubmissionWithDetails extends SubmissionWithSite {
  submitter: Pick<Profile, 'id' | 'display_name'> | null
}

/** Statuses an admin can set during review (not draft). */
export const ADMIN_REVIEW_STATUSES = [
  'under_review',
  'approved',
  'rejected',
] as const satisfies readonly SubmissionStatus[]

export type AdminReviewStatus = (typeof ADMIN_REVIEW_STATUSES)[number]

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
}

/** Client mirrors of Storage bucket constraints (see migration). */
export const PHOTO_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type PhotoContentType = (typeof PHOTO_ALLOWED_TYPES)[number]

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024 // 8 MiB
export const PHOTO_BUCKET = 'submission-photos'
