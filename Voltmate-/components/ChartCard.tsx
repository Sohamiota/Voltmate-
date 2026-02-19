'use client'

import { LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts'

interface ChartCardProps {
  title: string
  subtitle: string
  data?: any[]
}

export default function ChartCard({ title, subtitle, data = [] }: ChartCardProps) {
  const hasData = Array.isArray(data) && data.length > 0
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {!hasData ? (
        <div className="py-20 text-center text-muted-foreground">No chart data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }}
              interval={Math.floor(data.length / 7)} />
            <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(v: any) => [v, 'Visits']}
            />
            <Line
              type="monotone"
              dataKey="sales"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="flex gap-6 mt-6 pt-6 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total Visits (30 days)</p>
          <p className="text-lg font-bold text-foreground">{hasData ? data.reduce((s: any, d: any) => s + (d.sales || 0), 0) : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Peak Day</p>
          <p className="text-lg font-bold text-primary">{hasData ? Math.max(...data.map((d: any) => d.sales || 0)) : '—'}</p>
        </div>
      </div>
    </div>
  )
}
