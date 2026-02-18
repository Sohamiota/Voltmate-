'use client'

import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Calendar, Filter } from 'lucide-react'

const departmentData: any[] = []

const attendanceData: any[] = []

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics & Reports</h1>
          <p className="text-muted-foreground">Insights into your dealership performance</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-lg hover:bg-border transition-colors text-foreground">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-lg hover:bg-border transition-colors text-foreground">
            <Calendar className="w-4 h-4" />
            Date Range
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-foreground mb-6">Employee Distribution by Department</h2>
          {departmentData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No department distribution data</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Attendance Trend */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-foreground mb-6">Attendance Trend</h2>
          {attendanceData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No attendance trend data</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={attendanceData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" domain={[85, 100]} />
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
                  dataKey="attendance"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-2">Avg Performance Score</p>
          <p className="text-3xl font-bold text-primary mb-2">8.7/10</p>
          <div className="w-full bg-secondary rounded-full h-2">
            <div className="bg-primary h-2 rounded-full" style={{ width: '87%' }}></div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-2">Employee Satisfaction</p>
          <p className="text-3xl font-bold text-secondary mb-2">92%</p>
          <div className="w-full bg-secondary rounded-full h-2">
            <div className="bg-secondary h-2 rounded-full" style={{ width: '92%' }}></div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-2">Retention Rate</p>
          <p className="text-3xl font-bold text-green-400 mb-2">89%</p>
          <div className="w-full bg-secondary rounded-full h-2">
            <div className="bg-green-400 h-2 rounded-full" style={{ width: '89%' }}></div>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Key Insights</h2>
        <ul className="space-y-3">
          <li className="flex gap-3">
            <span className="text-primary font-bold">•</span>
            <span className="text-foreground">Sales team exceeded targets by 14% this month</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold">•</span>
            <span className="text-foreground">Employee attendance remains strong at 94% average</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold">•</span>
            <span className="text-foreground">New hire onboarding completion rate: 100%</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
