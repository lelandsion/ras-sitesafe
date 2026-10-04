import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyDailySafetyChecklist, serializeChecklist } from '../types/safetyChecklist'
import { exportSubmissionToPdf } from './exportSubmissionPdf'

const textCalls: string[] = []
const saveMock = vi.fn()

vi.mock('jspdf', () => {
  class MockJsPDF {
    internal = {
      pageSize: {
        getHeight: () => 297,
        getWidth: () => 210,
      },
    }
    setFillColor() {}
    setTextColor() {}
    setFont() {}
    setFontSize() {}
    setDrawColor() {}
    setLineWidth() {}
    rect() {}
    line() {}
    addPage() {}
    addImage() {}
    splitTextToSize(text: string) {
      return [text]
    }
    text(value: string | string[], ..._rest: unknown[]) {
      const chunk = Array.isArray(value) ? value.join(' ') : value
      textCalls.push(chunk)
    }
    getNumberOfPages() {
      return 1
    }
    setPage() {}
    save(name: string) {
      saveMock(name)
    }
  }
  return { jsPDF: MockJsPDF }
})

vi.mock('../services/photosService', () => ({
  getPhotoSignedUrl: vi.fn(async () => ({ url: null, error: null })),
}))

function filledChecklist() {
  const c = emptyDailySafetyChecklist('2026-10-02')
  c.ppe.hardHat = 'yes'
  c.ppe.highVis = 'yes'
  c.ppe.footwear = 'yes'
  c.ppe.eyeProtection = 'na'
  c.fallProtection.edgesProtected = 'yes'
  c.fallProtection.fpInUse = 'yes'
  c.fallProtection.ladders = 'yes'
  c.toolsAndWorkArea.toolsCondition = 'yes'
  c.toolsAndWorkArea.workAreaClear = 'yes'
  c.toolsAndWorkArea.housekeeping = 'no'
  c.hazards = {
    present: true,
    description: 'Loose sheathing',
    severity: 'moderate',
  }
  c.incidentOrNearMiss = { occurred: false, detail: '' }
  return c
}

describe('exportSubmissionToPdf structure', () => {
  beforeEach(() => {
    textCalls.length = 0
    saveMock.mockReset()
  })

  it('renders branded header, meta, checklist sections, and photo sections', async () => {
    await exportSubmissionToPdf({
      submission: {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        status: 'submitted',
        notes: 'Crew briefed at gate.',
        checklist: serializeChecklist(filledChecklist()),
        created_at: '2026-10-02T12:00:00.000Z',
        updated_at: '2026-10-02T13:00:00.000Z',
        sites: {
          id: 'site-1',
          name: 'Bear Mountain Townhomes',
          address: '100 Summit Rd',
        },
        submitter: { id: 'u1', display_name: 'Daniel Ortiz' },
      },
      photos: [
        {
          id: 'p1',
          submission_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          storage_path: 'u1/sub/site.jpg',
          content_type: 'image/jpeg',
          byte_size: 1200,
          photo_kind: 'site',
          created_at: '2026-10-02T12:30:00.000Z',
        },
        {
          id: 'p2',
          submission_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          storage_path: 'u1/sub/hazard.jpg',
          content_type: 'image/jpeg',
          byte_size: 1400,
          photo_kind: 'hazard',
          created_at: '2026-10-02T12:31:00.000Z',
        },
        {
          id: 'p3',
          submission_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          storage_path: 'u1/sub/issue.jpg',
          content_type: 'image/jpeg',
          byte_size: 1100,
          photo_kind: 'issue',
          created_at: '2026-10-02T12:32:00.000Z',
        },
      ],
      adminSummaryLines: ['Compliance review pending'],
    })

    const joined = textCalls.join('\n')
    expect(joined).toMatch(/RAS SiteSafe/)
    expect(joined).toMatch(/Daily Safety Check/)
    expect(joined).toMatch(/Bear Mountain Townhomes/)
    expect(joined).toMatch(/Daniel Ortiz/)
    expect(joined).toMatch(/PPE/)
    expect(joined).toMatch(/Fall protection/)
    expect(joined).toMatch(/Tools/)
    expect(joined).toMatch(/Hazards/)
    expect(joined).toMatch(/Loose sheathing/)
    expect(joined).toMatch(/Additional notes|Crew briefed/)
    expect(joined).toMatch(/Site safety summary|Compliance review/)
    expect(joined).toMatch(/3 photo\(s\) on file/)
    expect(joined).toMatch(/Confidential jobsite record|Page 1/)
    expect(saveMock).toHaveBeenCalledWith(
      expect.stringMatching(/^ras-sitesafe-daily-check-bear-mountain/),
    )
  })
})
