'use client'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const data = [
  { name: 'Week 1', sales: 4000, target: 3500 },
  { name: 'Week 2', sales: 5200, target: 3500 },
  { name: 'Week 3', sales: 4800, target: 3500 },
  { name: 'Week 4', sales: 6100, target: 3500 },
  { name: 'Week 5', sales: 5900, target: 3500 },
]

interface ChartCardProps {
  title: string
  subtitle: string
}

export default function ChartCard({ title, subtitle }: ChartCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
          <YAxis stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Line
            type="monotone"
            dataKey="sales"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            dot={{ fill: 'hsl(var(--primary))', r: 5 }}
            activeDot={{ r: 7 }}
          />
          <Line
            type="monotone"
            dataKey="target"
            stroke="hsl(var(--secondary))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex gap-6 mt-6 pt-6 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Actual Sales</p>
          <p className="text-lg font-bold text-foreground">$26,000</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Target</p>
          <p className="text-lg font-bold text-secondary">$17,500</p>
        </div>
      </div>
    </div>
  )
}
