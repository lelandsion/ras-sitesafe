import { describe, expect, it } from 'vitest'
import { emptyDailySafetyChecklist } from '../types/safetyChecklist'
import {
  reconcileIssueDrafts,
  requiredIssueSpecs,
  validateIssueDrafts,
} from './safetyIssueKeys'

describe('requiredIssueSpecs', () => {
  it('creates one issue key per No answer and hazard/incident', () => {
    const c = emptyDailySafetyChecklist('2026-10-02')
    c.ppe.hardHat = 'no'
    c.ppe.highVis = 'yes'
    c.hazards = {
      present: true,
      description: 'Loose plank',
      severity: 'moderate',
    }
    c.incidentOrNearMiss = { occurred: true, detail: 'Near miss on ladder' }

    const specs = requiredIssueSpecs(c)
    expect(specs.map((s) => s.key)).toEqual([
      'ppe.hardHat',
      'hazards',
      'incidentOrNearMiss',
    ])
    expect(specs.find((s) => s.key === 'hazards')?.defaultSeverity).toBe(
      'medium',
    )
  })
})

describe('reconcileIssueDrafts', () => {
  it('keeps drafts stable across reconcile (no duplicate keys)', () => {
    const c = emptyDailySafetyChecklist('2026-10-02')
    c.ppe.hardHat = 'no'
    const first = reconcileIssueDrafts(c, {})
    first['ppe.hardHat'].description = 'No hard hat on scaffold'
    first['ppe.hardHat'].severity = 'high'
    first['ppe.hardHat'].immediate_action = 'Stopped work'

    const second = reconcileIssueDrafts(c, first)
    expect(Object.keys(second)).toEqual(['ppe.hardHat'])
    expect(second['ppe.hardHat'].description).toBe('No hard hat on scaffold')
    expect(second['ppe.hardHat'].immediate_action).toBe('Stopped work')
  })

  it('drops drafts when answer is no longer No', () => {
    const c = emptyDailySafetyChecklist('2026-10-02')
    c.ppe.hardHat = 'no'
    const drafts = reconcileIssueDrafts(c, {})
    c.ppe.hardHat = 'yes'
    const next = reconcileIssueDrafts(c, drafts)
    expect(Object.keys(next)).toEqual([])
  })
})

describe('validateIssueDrafts', () => {
  it('requires description, severity, and immediate action', () => {
    expect(
      validateIssueDrafts({
        'ppe.hardHat': {
          checklist_item_key: 'ppe.hardHat',
          item_label: 'Hard hat worn',
          description: '',
          severity: 'high',
          immediate_action: 'Stop',
        },
      }),
    ).toMatch(/Describe/)

    expect(
      validateIssueDrafts({
        'ppe.hardHat': {
          checklist_item_key: 'ppe.hardHat',
          item_label: 'Hard hat worn',
          description: 'Missing hat',
          severity: null,
          immediate_action: 'Stop',
        },
      }),
    ).toMatch(/severity/i)

    expect(
      validateIssueDrafts({
        'ppe.hardHat': {
          checklist_item_key: 'ppe.hardHat',
          item_label: 'Hard hat worn',
          description: 'Missing hat',
          severity: 'high',
          immediate_action: 'Crew stopped; hard hats issued',
        },
      }),
    ).toBeNull()
  })
})
