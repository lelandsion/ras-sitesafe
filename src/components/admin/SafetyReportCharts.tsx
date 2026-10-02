import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const CATEGORY_FILL = [
  '#045339',
  '#033d2a',
  '#b45309',
  '#9b2c2c',
  '#6b7280',
]

type IssuesByCategoryProps = {
  data: { category: string; count: number }[]
}

export function IssuesByCategoryChart({ data }: IssuesByCategoryProps) {
  const filtered = data.filter((d) => d.count > 0)
  if (filtered.length === 0) {
    return (
      <p className="admin-chart__empty">No structured issues logged yet.</p>
    )
  }
  return (
    <div className="admin-chart" role="img" aria-label="Issues by category">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={filtered}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#d0d0d0" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="category"
            width={120}
            tick={{ fontSize: 11 }}
          />
          <Tooltip />
          <Bar dataKey="count" radius={[0, 2, 2, 0]} maxBarSize={28}>
            {filtered.map((entry, i) => (
              <Cell key={entry.category} fill={CATEGORY_FILL[i % CATEGORY_FILL.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

type TimeSeriesProps = {
  issues: { date: string; issues: number }[]
  compliance: { date: string; compliance: number }[]
}

export function SafetyTrendCharts({ issues, compliance }: TimeSeriesProps) {
  const merged = new Map<string, { date: string; issues: number; compliance: number | null }>()
  for (const row of issues) {
    merged.set(row.date, {
      date: row.date,
      issues: row.issues,
      compliance: merged.get(row.date)?.compliance ?? null,
    })
  }
  for (const row of compliance) {
    const prev = merged.get(row.date)
    merged.set(row.date, {
      date: row.date,
      issues: prev?.issues ?? 0,
      compliance: row.compliance,
    })
  }
  const data = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date))

  if (data.length === 0) {
    return (
      <p className="admin-chart__empty">
        Submit daily safety checks to populate trend charts.
      </p>
    )
  }

  return (
    <div className="admin-chart-grid">
      <div className="admin-chart" role="img" aria-label="Issues over time">
        <h4 className="admin-chart-panel__subtitle">Issues over time</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d0d0d0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="issues"
              stroke="#9b2c2c"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Issues"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="admin-chart" role="img" aria-label="Compliance over time">
        <h4 className="admin-chart-panel__subtitle">Compliance % over time</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d0d0d0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} width={36} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="compliance"
              stroke="#045339"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Compliance %"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
