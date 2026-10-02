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
