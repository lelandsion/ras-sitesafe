import {
  caAttentionBadgeLabel,
  type SubmissionCaAttention,
} from '../../lib/caAttention'

export function CaAttentionBadge({
  attention,
}: {
  attention: SubmissionCaAttention | null | undefined
}) {
  const label = caAttentionBadgeLabel(attention)
  if (!label || !attention) return null

  const modifier =
    attention === 'ready_for_review'
      ? 'ca-attention-badge--ready'
      : 'ca-attention-badge--active'

  return (
    <span
      className={`ca-attention-badge ${modifier}`}
      data-testid={`ca-attention-${attention}`}
    >
      {label}
    </span>
  )
}
