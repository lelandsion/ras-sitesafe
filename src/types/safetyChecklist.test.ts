import { describe, expect, it } from 'vitest'
import {
  emptyDailySafetyChecklist,
  parseDailySafetyChecklist,
  validateDailySafetyChecklist,
} from './safetyChecklist'

describe('daily safety checklist', () => {
  it('parses legacy empty object as defaults', () => {
    const c = parseDailySafetyChecklist({})
    expect(c.reportType).toBe('daily_safety_check')
    expect(c.ppe.hardHat).toBeNull()
  })

  it('requires all tri-state answers before submit', () => {
    const c = emptyDailySafetyChecklist('2026-10-02')
    expect(validateDailySafetyChecklist(c)).toMatch(/every checklist item/i)
  })

  it('requires hazard detail when present', () => {
    let c = emptyDailySafetyChecklist('2026-10-02')
    for (const group of ['ppe', 'fallProtection', 'toolsAndWorkArea'] as const) {
      const section = c[group] as Record<string, 'yes'>
      for (const key of Object.keys(section)) {
        ;(section as Record<string, 'yes'>)[key] = 'yes'
      }
    }
    c = {
      ...c,
      hazards: { present: true, description: '', severity: null },
      incidentOrNearMiss: { occurred: false, detail: '' },
    }
    expect(validateDailySafetyChecklist(c)).toMatch(/Describe the hazard/)
  })
})
