import { describe, expect, it } from 'vitest'
import {
  buildSubmissionPdfFilename,
  triLabel,
} from './exportSubmissionPdf'

describe('exportSubmissionPdf helpers', () => {
  it('builds a stable slug filename', () => {
    expect(
      buildSubmissionPdfFilename(
        '80374b83-aaaa-bbbb-cccc-dddddddddddd',
        'Bear Mountain — Townhomes Framing',
      ),
    ).toBe(
      'ras-sitesafe-daily-check-bear-mountain-townhomes-framing-80374b83.pdf',
    )
  })

  it('labels tri-state values', () => {
    expect(triLabel('yes')).toMatch(/yes/i)
    expect(triLabel('no')).toMatch(/no/i)
    expect(triLabel('na')).toMatch(/n\/a|na/i)
    expect(triLabel(null)).toBe('—')
  })
})
