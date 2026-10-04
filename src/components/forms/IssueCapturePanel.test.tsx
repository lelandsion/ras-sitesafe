import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { IssueDraft } from '../../lib/safetyIssueKeys'
import { IssueCapturePanel, type IssuePhotoUploadProps } from './IssueCapturePanel'

vi.mock('./PhotoUpload', () => ({
  PhotoUpload: (props: { photoKind?: string; triggerLabel?: string }) => (
    <div data-testid={`photo-upload-${props.photoKind ?? 'site'}`}>
      {props.triggerLabel}
    </div>
  ),
}))

function draft(key: IssueDraft['checklist_item_key'], label: string): IssueDraft {
  return {
    checklist_item_key: key,
    item_label: label,
    description: '',
    severity: null,
    immediate_action: '',
  }
}

const photoUpload: IssuePhotoUploadProps = {
  userId: 'u1',
  submissionId: 's1',
  photos: [],
  onChange: vi.fn(),
}

describe('IssueCapturePanel', () => {
  it('shows PhotoUpload issue control for checklist No capture', () => {
    render(
      <IssueCapturePanel
        draft={draft('ppe.hardHat', 'Hard hat worn')}
        onChange={vi.fn()}
        photoUpload={photoUpload}
      />,
    )
    expect(screen.getByTestId('issue-photo-ppe.hardHat')).toBeInTheDocument()
    expect(screen.getByTestId('photo-upload-issue')).toBeInTheDocument()
    expect(screen.getByText('Add issue photo')).toBeInTheDocument()
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
        photoUpload={photoUpload}
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
        photoUpload={photoUpload}
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
