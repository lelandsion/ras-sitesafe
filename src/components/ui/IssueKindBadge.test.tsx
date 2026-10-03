import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IssueKindBadge } from './IssueKindBadge'

describe('IssueKindBadge', () => {
  it('labels checklist, hazard, and incident distinctly', () => {
    const { rerender } = render(<IssueKindBadge kind="checklist" />)
    expect(screen.getByTestId('issue-kind-checklist')).toHaveTextContent(
      'Checklist failure',
    )

    rerender(<IssueKindBadge kind="hazard" />)
    expect(screen.getByTestId('issue-kind-hazard')).toHaveTextContent('Hazard')

    rerender(<IssueKindBadge kind="incident" />)
    expect(screen.getByTestId('issue-kind-incident')).toHaveTextContent(
      'Incident',
    )
  })
})
