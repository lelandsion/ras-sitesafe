import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SubmissionStatus } from '../../types/database'
import { StatusBadge } from './StatusBadge'

const CASES: { status: SubmissionStatus; label: string; classSuffix: string }[] = [
  { status: 'draft', label: 'Draft', classSuffix: 'draft' },
  { status: 'submitted', label: 'Submitted', classSuffix: 'submitted' },
  { status: 'under_review', label: 'Under review', classSuffix: 'review' },
  { status: 'approved', label: 'Reviewed', classSuffix: 'approved' },
  { status: 'rejected', label: 'Rejected', classSuffix: 'rejected' },
]

describe('StatusBadge', () => {
  it.each(CASES)(
    'renders $label with status-badge--$classSuffix',
    ({ status, label, classSuffix }) => {
      const { container } = render(<StatusBadge status={status} />)
      const badge = screen.getByText(label)
      expect(badge).toBeInTheDocument()
      expect(container.firstChild).toHaveClass('status-badge')
      expect(container.firstChild).toHaveClass(`status-badge--${classSuffix}`)
    },
  )
})
