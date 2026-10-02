import { describe, expect, it } from 'vitest'
import {
  complianceRate,
  countStructuredIssues,
  issuesByCategory,
} from './checklistAnalytics'
import {
  emptyDailySafetyChecklist,
  serializeChecklist,
} from '../types/safetyChecklist'

function filledChecklist() {
  const c = emptyDailySafetyChecklist('2026-10-02')
  c.ppe.hardHat = 'yes'
  c.ppe.highVis = 'no'
  c.ppe.footwear = 'yes'
  c.ppe.eyeProtection = 'na'
  c.fallProtection.edgesProtected = 'yes'
  c.fallProtection.fpInUse = 'yes'
  c.fallProtection.ladders = 'yes'
  c.toolsAndWorkArea.toolsCondition = 'yes'
  c.toolsAndWorkArea.workAreaClear = 'yes'
  c.toolsAndWorkArea.housekeeping = 'yes'
  c.hazards = { present: false, description: '', severity: null }
  c.incidentOrNearMiss = { occurred: false, detail: '' }
  return c
}

describe('checklistAnalytics', () => {
  it('computes compliance excluding N/A', () => {
    const rate = complianceRate(filledChecklist())
    expect(rate).toBe(89)
  })

  it('counts no answers and flags as issues', () => {
    expect(countStructuredIssues(filledChecklist())).toBe(1)
  })

  it('aggregates issues by category', () => {
    const rows = [
      {
        id: '1',
        status: 'submitted' as const,
        checklist: serializeChecklist(filledChecklist()),
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
        siteName: 'Site A',
        workerName: 'Daniel',
      },
    ]
    const data = issuesByCategory(rows)
    expect(data.find((d) => d.category === 'PPE')?.count).toBe(1)
  })
})
