import { describe, expect, it } from 'vitest'
import {
  aggregateSafetyMetrics,
  buildOpenIssues,
  buildPeriodIssues,
  complianceRate,
  countStructuredIssues,
  issuesByCategory,
  issuesOverTime,
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

function hazardChecklist() {
  const c = filledChecklist()
  c.hazards = {
    present: true,
    description: 'Uncovered opening',
    severity: 'high',
  }
  c.incidentOrNearMiss = { occurred: true, detail: 'Near miss at stair' }
  return c
}

describe('checklistAnalytics', () => {
  it('computes compliance excluding N/A', () => {
    const rate = complianceRate(filledChecklist())
    expect(rate).toBe(89)
  })

  it('counts no answers and flags as issues', () => {
    expect(countStructuredIssues(filledChecklist())).toBe(1)
    expect(countStructuredIssues(hazardChecklist())).toBe(3)
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

  it('builds open issues from submitted checks and skips drafts/approved', () => {
    const rows = [
      {
        id: 'open',
        status: 'submitted' as const,
        checklist: serializeChecklist(hazardChecklist()),
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
        siteName: 'Site A',
        workerName: 'Daniel',
      },
      {
        id: 'draft',
        status: 'draft' as const,
        checklist: serializeChecklist(hazardChecklist()),
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
        siteName: 'Site A',
        workerName: 'Daniel',
      },
      {
        id: 'done',
        status: 'approved' as const,
        checklist: serializeChecklist(hazardChecklist()),
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
        siteName: 'Site A',
        workerName: 'Daniel',
      },
    ]
    const open = buildOpenIssues(rows)
    expect(open.every((i) => i.submissionId === 'open')).toBe(true)
    expect(open.some((i) => i.category === 'Hazard')).toBe(true)
    expect(open.some((i) => i.category === 'Incident / near miss')).toBe(true)

    const period = buildPeriodIssues(rows)
    expect(period.some((i) => i.submissionId === 'open')).toBe(true)
    expect(period.some((i) => i.submissionId === 'done')).toBe(true)
    expect(period.every((i) => i.submissionId !== 'draft')).toBe(true)
  })

  it('aggregates safety metrics across non-draft rows', () => {
    const rows = [
      {
        id: '1',
        status: 'submitted' as const,
        checklist: serializeChecklist(hazardChecklist()),
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
        siteName: 'Site A',
        workerName: 'Daniel',
      },
      {
        id: '2',
        status: 'draft' as const,
        checklist: serializeChecklist(hazardChecklist()),
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
        siteName: 'Site A',
        workerName: 'Daniel',
      },
    ]
    const metrics = aggregateSafetyMetrics(rows)
    expect(metrics.submissions).toBe(1)
    expect(metrics.hazardReports).toBe(1)
    expect(metrics.incidents).toBe(1)
    expect(metrics.openIssueCount).toBeGreaterThan(0)
  })

  it('series helpers return dated points for charts', () => {
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
    const series = issuesOverTime(rows)
    expect(series.length).toBeGreaterThan(0)
    expect(series[0]).toEqual(
      expect.objectContaining({ date: expect.any(String), issues: expect.any(Number) }),
    )
  })
})
