import { describe, expect, it } from 'vitest'
import {
  collectDailySafetyChecklistErrors,
  emptyDailySafetyChecklist,
  parseDailySafetyChecklist,
  serializeChecklist,
  validateDailySafetyChecklist,
} from './safetyChecklist'

function fillTriStates(
  c: ReturnType<typeof emptyDailySafetyChecklist>,
  value: 'yes' | 'no' | 'na' = 'yes',
) {
  for (const group of ['ppe', 'fallProtection', 'toolsAndWorkArea'] as const) {
    const section = c[group] as Record<string, typeof value>
    for (const key of Object.keys(section)) {
      section[key] = value
    }
  }
  return c
}

describe('daily safety checklist', () => {
  it('parses legacy empty object as defaults', () => {
    const c = parseDailySafetyChecklist({})
    expect(c.reportType).toBe('daily_safety_check')
    expect(c.ppe.hardHat).toBeNull()
  })

  it('round-trips through serialize + parse', () => {
    const original = fillTriStates(emptyDailySafetyChecklist('2026-10-02'))
    original.hazards = {
      present: true,
      description: 'Open trench',
      severity: 'high',
    }
    original.incidentOrNearMiss = { occurred: false, detail: '' }
    const again = parseDailySafetyChecklist(serializeChecklist(original))
    expect(again.hazards.description).toBe('Open trench')
    expect(again.hazards.severity).toBe('high')
    expect(again.ppe.hardHat).toBe('yes')
  })

  it('requires all tri-state answers before submit', () => {
    const c = emptyDailySafetyChecklist('2026-10-02')
    expect(validateDailySafetyChecklist(c)).toMatch(/Hard hat worn/)
  })

  it('requires hazard present answer after checklist items', () => {
    const c = fillTriStates(emptyDailySafetyChecklist('2026-10-02'))
    expect(validateDailySafetyChecklist(c)).toMatch(/hazard was observed/i)
  })

  it('requires hazard detail when present', () => {
    let c = fillTriStates(emptyDailySafetyChecklist('2026-10-02'))
    c = {
      ...c,
      hazards: { present: true, description: '', severity: null },
      incidentOrNearMiss: { occurred: false, detail: '' },
    }
    expect(validateDailySafetyChecklist(c)).toMatch(/Describe the hazard/)
  })

  it('requires hazard severity when present with description', () => {
    let c = fillTriStates(emptyDailySafetyChecklist('2026-10-02'))
    c = {
      ...c,
      hazards: { present: true, description: 'Loose plank', severity: null },
      incidentOrNearMiss: { occurred: false, detail: '' },
    }
    expect(validateDailySafetyChecklist(c)).toBe(
      'Select a severity for the hazard.',
    )
  })

  it('requires incident detail when occurred is yes', () => {
    let c = fillTriStates(emptyDailySafetyChecklist('2026-10-02'))
    c = {
      ...c,
      hazards: { present: false, description: '', severity: null },
      incidentOrNearMiss: { occurred: true, detail: '  ' },
    }
    expect(validateDailySafetyChecklist(c)).toMatch(
      /Describe the incident or near miss/,
    )
  })

  it('accepts a complete checklist', () => {
    let c = fillTriStates(emptyDailySafetyChecklist('2026-10-02'))
    c = {
      ...c,
      hazards: { present: false, description: '', severity: null },
      incidentOrNearMiss: { occurred: false, detail: '' },
    }
    expect(validateDailySafetyChecklist(c)).toBeNull()
  })

  it('collects multiple field errors including jobsite', () => {
    const c = emptyDailySafetyChecklist('2026-10-02')
    c.hazards = { present: true, description: '', severity: null }
    c.incidentOrNearMiss = { occurred: true, detail: '' }

    const errors = collectDailySafetyChecklistErrors(c, { siteId: '' })
    const fields = errors.map((e) => e.field)
    expect(fields).toContain('siteId')
    expect(fields).toContain('ppe.hardHat')
    expect(fields).toContain('hazards.description')
    expect(fields).toContain('hazards.severity')
    expect(fields).toContain('incidentOrNearMiss.detail')
    expect(errors.find((e) => e.field === 'siteId')?.message).toBe(
      'Select a jobsite.',
    )
    expect(errors.find((e) => e.field === 'hazards.severity')?.message).toBe(
      'Select a severity for the hazard.',
    )
  })
})
