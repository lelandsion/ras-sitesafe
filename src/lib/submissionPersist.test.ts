import { describe, expect, it } from 'vitest'
import {
  allowImplicitFormSubmit,
  draftSavedNotice,
  persistSuccessMessage,
  readFormNotice,
  shouldLeaveFormAfterPersist,
  statusForPersistIntent,
} from './submissionPersist'

describe('submissionPersist', () => {
  it('maps draft intent to draft status (never submitted)', () => {
    expect(statusForPersistIntent('draft')).toBe('draft')
    expect(statusForPersistIntent('submit')).toBe('submitted')
  })

  it('draft success copy says draft saved, not submitted', () => {
    expect(persistSuccessMessage('draft', false)).toMatch(/Draft saved/i)
    expect(persistSuccessMessage('draft', false)).not.toMatch(/submitted/i)
    expect(draftSavedNotice(false)).toMatch(/Draft saved/i)
    expect(persistSuccessMessage('submit', false)).toMatch(/submitted/i)
  })

  it('draft save stays on the form; submit leaves', () => {
    expect(shouldLeaveFormAfterPersist('draft')).toBe(false)
    expect(shouldLeaveFormAfterPersist('submit')).toBe(true)
  })

  it('blocks implicit form submit (Enter key)', () => {
    expect(allowImplicitFormSubmit()).toBe(false)
  })

  it('reads draft notice from navigation state', () => {
    expect(readFormNotice({ formNotice: 'Draft saved.' })).toBe('Draft saved.')
    expect(readFormNotice({})).toBeNull()
    expect(readFormNotice(null)).toBeNull()
  })
})
