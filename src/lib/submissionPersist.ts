import type { SubmissionStatus } from '../types/database'

/** Explicit persist intents — draft must never finalize. */
export type PersistIntent = 'draft' | 'submit'

export function statusForPersistIntent(
  intent: PersistIntent,
): Extract<SubmissionStatus, 'draft' | 'submitted'> {
  return intent === 'submit' ? 'submitted' : 'draft'
}

export function persistSuccessMessage(
  intent: PersistIntent,
  isAdmin: boolean,
): string {
  if (intent === 'submit') return 'Safety check submitted for review.'
  return isAdmin ? 'Report saved.' : 'Draft saved. It stays private until you submit.'
}

/** Submit (finalize) navigates home; draft stays on the form. */
export function shouldLeaveFormAfterPersist(intent: PersistIntent): boolean {
  return intent === 'submit'
}

/**
 * Implicit form submit (Enter key / native submit) must never finalize.
 * Only an explicit Submit button click may call persist('submit').
 */
export function allowImplicitFormSubmit(): boolean {
  return false
}

export type FormNoticeState = {
  formNotice?: string
}

export function draftSavedNotice(isAdmin: boolean): string {
  return persistSuccessMessage('draft', isAdmin)
}

export function readFormNotice(
  state: unknown,
): string | null {
  if (!state || typeof state !== 'object') return null
  const notice = (state as FormNoticeState).formNotice
  return typeof notice === 'string' && notice.trim() ? notice : null
}
