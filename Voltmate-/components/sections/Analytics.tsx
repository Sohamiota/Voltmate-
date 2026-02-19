'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import { Calendar, Filter, Download, RefreshCw, X } from 'lucide-react'
import { get } from '../../src/api/client'

const ROLE_COLORS: Record<string, string> = {
  admin:    '#00d9ff',
  sales:    '#7c3aed',
  service:  '#22c55e',
  employee: '#f59e0b',
  other:    '#6b7280',
}

function isoWeekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function buildDeptData(employees: any[]) {
  const counts: Record<string, number> = {}
  for (const e of employees) {
    const role = e.role || 'employee'
    counts[role] = (counts[role] || 0) + 1
  }
  return Object.entries(counts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: ROLE_COLORS[name] || ROLE_COLORS.other,
  }))
}

function buildAttendanceTrend(records: any[], startDate?: string, endDate?: string) {
  const weekMap: Record<string, Set<number>> = {}
  for (const r of records) {
    if (!r.date) continue
    if (startDate && r.date < startDate) continue
    if (endDate && r.date > endDate) continue
    const label = isoWeekLabel(r.date)
    if (!weekMap[label]) weekMap[label] = new Set()
    weekMap[label].add(r.user_id)
  }
  return Object.entries(weekMap)
    .map(([week, users]) => ({ week, present: users.size }))
    .slice(-8)
}

function buildLeadsByType(leads: any[]) {
  const counts: Record<string, number> = {}
  for (const l of leads) {
    const t = l.lead_type || 'Unknown'
    counts[t] = (counts[t] || 0) + 1
  }
  return Object.entries(counts).map(([type, count]) => ({ type, count }))
}

function downloadCSV(rows: any[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(',')]
    .concat(rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(',')))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// Custom pie label — only shows on larger screens via short text
const renderPieLabel = ({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`

export default function Analytics() {
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('auth_token') || localStorage.getItem('token') || '')
    : ''

  const [employees,  setEmployees]  = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [leads,      setLeads]      = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  const today     = new Date().toISOString().slice(0, 10)
  const thirtyAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  const [startDate,      setStartDate]      = useState(thirtyAgo)
  const [endDate,        setEndDate]        = useState(today)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showFilter,     setShowFilter]     = useState(false)
  const [roleFilter,     setRoleFilter]     = useState('all')

  const dateRef   = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dateRef.current   && !dateRef.current.contains(e.target as Node))   setShowDatePicker(false)
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchAll = useCallback(async () => {
    if (!token) return
    setLoading(true); setError('')
    try {
      const [empRes, attRes, leadRes] = await Promise.all([
        get('/auth/employees', token),
        get(`/attendance?limit=500&startDate=${startDate}&endDate=${endDate}`, token),
        get(`/leads?limit=500&startDate=${startDate}&endDate=${endDate}`, token),
      ])
      setEmployees(empRes.employees || [])
      setAttendance(attRes.attendance || [])
      setLeads(leadRes.leads || [])
    } catch (e: any) {
      setError(e.message || 'Failed to fetch analytics data')
    } finally {
      setLoading(false)
    }
  }, [token, startDate, endDate])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filteredEmployees = roleFilter === 'all' ? employees : employees.filter(e => e.role === roleFilter)
  const deptData     = buildDeptData(filteredEmployees)
  const trendData    = buildAttendanceTrend(attendance, startDate, endDate)
  const leadsBarData = buildLeadsByType(leads)

  const totalEmployees = filteredEmployees.length
  const totalPresent   = new Set(attendance.map(a => a.user_id)).size
  const attendanceRate = totalEmployees > 0 ? Math.round((totalPresent / totalEmployees) * 100) : 0
  const totalLeads     = leads.length
  const durSessions    = attendance.filter(a => a.duration_seconds)
  const avgDuration    = durSessions.length
    ? Math.round(durSessions.reduce((s, a) => s + a.duration_seconds, 0) / durSessions.length / 3600 * 10) / 10
    : 0
  const uniqueRoles = [...new Set(employees.map(e => e.role).filter(Boolean))]

  const insights: string[] = []
  if (totalEmployees > 0) insights.push(`${totalEmployees} active employee${totalEmployees !== 1 ? 's' : ''} across ${deptData.length} role${deptData.length !== 1 ? 's' : ''}`)
  if (attendance.length > 0) insights.push(`${totalPresent} unique employee${totalPresent !== 1 ? 's' : ''} clocked in during the selected period (${attendanceRate}% coverage)`)
  if (avgDuration > 0) insights.push(`Average shift duration: ${avgDuration}h per session`)
  if (totalLeads > 0) insights.push(`${totalLeads} lead${totalLeads !== 1 ? 's' : ''} generated between ${startDate} and ${endDate}`)
  if (insights.length === 0) insights.push('No data available for the selected date range.')

  const tooltipStyle = {
    contentStyle: { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' },
    labelStyle: { color: 'hsl(var(--foreground))' },
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Analytics &amp; Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Live insights powered by real employee &amp; attendance data</p>
        </div>

        {/* Toolbar — wraps on mobile */}
        <div className="flex flex-wrap gap-2">

          {/* Filter */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => { setShowFilter(p => !p); setShowDatePicker(false) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-lg hover:bg-border transition-colors text-foreground text-sm"
            >
              <Filter className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Filter{roleFilter !== 'all' ? `: ${roleFilter}` : ''}</span>
            </button>
            {showFilter && (
              <div className="absolute left-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-xl z-20 p-3 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Filter by Role</p>
                {['all', ...uniqueRoles].map(r => (
                  <button key={r}
                    onClick={() => { setRoleFilter(r); setShowFilter(false) }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${roleFilter === r ? 'bg-primary/20 text-primary' : 'hover:bg-secondary text-foreground'}`}
                  >{r === 'all' ? 'All Roles' : r}</button>
                ))}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="relative" ref={dateRef}>
            <button
              onClick={() => { setShowDatePicker(p => !p); setShowFilter(false) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-lg hover:bg-border transition-colors text-foreground text-sm"
            >
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">{startDate} → {endDate}</span>
              <span className="sm:hidden">Dates</span>
            </button>
            {showDatePicker && (
              <div className="absolute left-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-20 p-4 w-72 max-w-[calc(100vw-32px)]">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-semibold text-foreground">Date Range</p>
                  <button onClick={() => setShowDatePicker(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">From</label>
                  <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary" />
                  <label className="text-xs text-muted-foreground">To</label>
                  <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary" />
                  <div className="flex gap-2 mt-3">
                    {[{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }].map(({ label, days }) => (
                      <button key={label}
                        onClick={() => { setStartDate(new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)); setEndDate(today) }}
                        className="flex-1 text-xs py-1.5 bg-secondary border border-border rounded-lg hover:bg-border text-foreground transition-colors"
                      >{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Refresh */}
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-lg hover:bg-border transition-colors text-foreground text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export */}
          <button
            onClick={() => downloadCSV(attendance.map(a => ({
              employee_name: a.employee_name || '', employee_email: a.employee_email || '',
              date: a.date || '', clock_in: a.clock_in_at || '', clock_out: a.clock_out_at || '',
              duration_h: a.duration_seconds ? +(a.duration_seconds / 3600).toFixed(2) : '', status: a.status || '',
            })), 'attendance-report.csv')}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {error && <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">{error}</div>}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Employees', value: totalEmployees,       color: 'text-primary' },
          { label: 'Present (Period)', value: totalPresent,         color: 'text-green-400' },
          { label: 'Attendance Rate',  value: `${attendanceRate}%`, color: 'text-yellow-400' },
          { label: 'Leads Generated',  value: totalLeads,           color: 'text-purple-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 sm:p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 leading-tight">{label}</p>
            <p className={`text-2xl sm:text-3xl font-bold ${color}`}>{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Dept Distribution */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-semibold text-foreground mb-1">Employee Distribution by Department</h2>
          <p className="text-xs text-muted-foreground mb-4">Grouped by role</p>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : deptData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No employee data.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={deptData} cx="50%" cy="50%" outerRadius="70%"
                    labelLine={false} label={renderPieLabel} dataKey="value">
                    {deptData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: any, n: any) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-3">
                {deptData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ background: d.color }} />
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Attendance Trend */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-semibold text-foreground mb-1">Attendance Trend</h2>
          <p className="text-xs text-muted-foreground mb-4">Unique employees per week</p>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : trendData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No attendance in range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => [v, 'Present']} />
                <Line type="monotone" dataKey="present" stroke="hsl(var(--primary))"
                  strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Leads by Type */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-semibold text-foreground mb-1">Leads by Type</h2>
          <p className="text-xs text-muted-foreground mb-4">From lead report data</p>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : leadsBarData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No leads in range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsBarData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="type" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
                <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Avg Shift Duration */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-foreground mb-1">Avg Shift Duration</h2>
            <p className="text-xs text-muted-foreground mb-4">Average hours per attendance session</p>
            {loading ? (
              <div className="text-muted-foreground text-sm">Loading…</div>
            ) : (
              <>
                <p className="text-4xl sm:text-5xl font-bold text-primary mb-2">{avgDuration}h</p>
                <div className="w-full bg-secondary rounded-full h-2 mt-4">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${Math.min(avgDuration / 10 * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Based on {durSessions.length} completed sessions</p>
              </>
            )}
          </div>
          <button
            onClick={() => downloadCSV(employees.map(e => ({ id: e.id, name: e.name, email: e.email, role: e.role, joined: e.created_at })), 'employees-report.csv')}
            className="mt-6 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Employee List
          </button>
        </div>
      </div>

      {/* ── Key Insights ── */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-xl p-4 sm:p-6">
        <h2 className="text-sm sm:text-base font-semibold text-foreground mb-4">Key Insights</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Generating insights…</p>
        ) : (
          <ul className="space-y-3">
            {insights.map((ins, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-primary font-bold mt-0.5 flex-shrink-0">•</span>
                <span className="text-foreground text-sm">{ins}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
