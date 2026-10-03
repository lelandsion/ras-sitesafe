import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { IssueDraft } from '../../lib/safetyIssueKeys'
import { IssueCapturePanel } from './IssueCapturePanel'

function draft(key: IssueDraft['checklist_item_key'], label: string): IssueDraft {
  return {
    checklist_item_key: key,
    item_label: label,
    description: '',
    severity: null,
    immediate_action: '',
    pendingPhoto: null,
  }
}

describe('IssueCapturePanel', () => {
  it('shows optional issue photo for checklist No capture', () => {
    render(
      <IssueCapturePanel
        draft={draft('ppe.hardHat', 'Hard hat worn')}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('issue-photo-ppe.hardHat')).toBeInTheDocument()
    expect(screen.getByTestId('issue-capture-ppe.hardHat')).toHaveAttribute(
      'data-show-issue-photo',
      'true',
    )
  })

  it('hides issue photo for hazard / incident keys', () => {
    const { rerender } = render(
      <IssueCapturePanel
        draft={draft('hazards', 'Hazard observed')}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('issue-photo-hazards')).not.toBeInTheDocument()
    expect(screen.getByTestId('issue-capture-hazards')).toHaveAttribute(
      'data-show-issue-photo',
      'false',
    )

    rerender(
      <IssueCapturePanel
        draft={draft('incidentOrNearMiss', 'Incident / near miss')}
        onChange={vi.fn()}
      />,
    )
    expect(
      screen.queryByTestId('issue-photo-incidentOrNearMiss'),
    ).not.toBeInTheDocument()
  })

  it('renders field-level validation messages', () => {
    render(
      <IssueCapturePanel
        draft={draft('ppe.highVis', 'High-vis vest')}
        onChange={vi.fn()}
        errors={{
          description: 'Describe the issue for “High-vis vest”.',
          severity: 'Select a severity for “High-vis vest”.',
        }}
      />,
    )
    expect(
      screen.getByText('Describe the issue for “High-vis vest”.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Select a severity for “High-vis vest”.'),
    ).toBeInTheDocument()
  })
})
