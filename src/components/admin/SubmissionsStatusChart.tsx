import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SubmissionStatus } from '../../types/database'
import { SUBMISSION_STATUS_LABELS } from '../../types/database'

const STATUS_ORDER: SubmissionStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
]

const STATUS_FILL: Record<SubmissionStatus, string> = {
  draft: '#9ca3af',
  submitted: '#045339',
  under_review: '#b45309',
  approved: '#033d2a',
  rejected: '#9b2c2c',
}

export function buildStatusCounts(
  statuses: SubmissionStatus[],
): { status: SubmissionStatus; label: string; count: number }[] {
  const counts: Record<SubmissionStatus, number> = {
    draft: 0,
    submitted: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
  }
  for (const s of statuses) {
    counts[s] += 1
  }
  return STATUS_ORDER.map((status) => ({
    status,
    label: SUBMISSION_STATUS_LABELS[status],
    count: counts[status],
  }))
}

interface SubmissionsStatusChartProps {
  statuses: SubmissionStatus[]
}

export function SubmissionsStatusChart({
  statuses,
}: SubmissionsStatusChartProps) {
  const data = buildStatusCounts(statuses)
  const hasAny = data.some((d) => d.count > 0)

  if (!hasAny) {
    return (
      <p className="admin-chart__empty">No submissions to chart yet.</p>
    )
  }

  return (
    <div className="admin-chart" role="img" aria-label="Submissions by status">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: -8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#d0d0d0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#3e3e3e', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2829' }}
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#3e3e3e', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ fill: 'rgba(4, 83, 57, 0.08)' }}
            contentStyle={{
              border: '2px solid #2a2829',
              borderRadius: 2,
              fontFamily: 'Source Sans 3, sans-serif',
            }}
            formatter={(value) => [value ?? 0, 'Count']}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={56}>
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_FILL[entry.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
