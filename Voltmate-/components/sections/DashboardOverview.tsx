'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Users, TrendingUp, Clock, CheckCircle, CalendarDays, WifiOff } from 'lucide-react'
import StatCard from '@/components/StatCard'
import ChartCard from '@/components/ChartCard'
import { API_BASE, getStoredToken } from '@/src/api/client'

const FETCH_TIMEOUT_MS = 12_000

function authHdr(): Record<string, string> {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** fetch() with timeout — works in all browsers */
function apiFetch(path: string) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  return fetch(`${API_BASE}${path}`, { headers: authHdr(), signal: ctrl.signal })
    .finally(() => clearTimeout(id))
}

function buildDailySales(visits: { visit_date?: string }[], days = 30) {
  const now = new Date()
  const result: { name: string; sales: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    const count = visits.filter(v => (v.visit_date || '').slice(0, 10) === iso).length
    result.push({ name: label, sales: count })
  }
  return result
}

export default function DashboardOverview() {
  const [userName,     setUserName]     = useState('Manager')
  const [empCount,     setEmpCount]     = useState<number | null>(null)
  const [visitsMonth,  setVisitsMonth]  = useState<number | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [attendRate,   setAttendRate]   = useState<number | null>(null)
  const [leaveCl,      setLeaveCl]      = useState<number | null>(null)
  const [leaveSl,      setLeaveSl]      = useState<number | null>(null)
  const [leaveFy,      setLeaveFy]      = useState<string | null>(null)
  const [chartData,    setChartData]    = useState(() => buildDailySales([], 30))
  const [refreshing,   setRefreshing]   = useState(true)
  const [backendError, setBackendError] = useState<string | null>(null)

  const retryCountRef = useRef(0)
  const mountedRef    = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchAll = useCallback(async (isAutoRetry = false) => {
    if (!getStoredToken()) {
      setRefreshing(false)
      setBackendError('Not signed in. Please log in again.')
      return
    }

    setRefreshing(true)
    if (!isAutoRetry) {
      setBackendError(null)
      retryCountRef.current = 0
    }

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const since30 = new Date(now)
    since30.setDate(now.getDate() - 30)
    const since30Str = since30.toISOString().slice(0, 10)

    let successCount = 0

    async function loadMe() {
      try {
        const r = await apiFetch('/auth/me')
        if (!r.ok) return
        successCount++
        const j = await r.json()
        if (!mountedRef.current) return
        setUserName(((j.user?.name || j.user?.email || 'Manager') as string).split(' ')[0])
      } catch { /* timeout */ }
    }

    async function loadEmployees() {
      try {
        const r = await apiFetch('/auth/employees')
        if (!r.ok) return
        successCount++
        const j = await r.json()
        if (!mountedRef.current) return
        setEmpCount((j.employees || []).length)
      } catch { /* timeout */ }
    }

    async function loadVisits() {
      try {
        const r = await apiFetch(`/visits?limit=1000&visit_date_from=${since30Str}`)
        if (!r.ok) return
        successCount++
        const j = await r.json()
        const all: { visit_date?: string }[] = j.visits || []
        if (!mountedRef.current) return
        setVisitsMonth(all.filter(v => (v.visit_date || '').slice(0, 10) >= monthStart).length)
        setChartData(buildDailySales(all, 30))
      } catch { /* timeout */ }
    }

    async function loadStats() {
      try {
        const r = await apiFetch('/attendance/stats')
        if (!r.ok) return
        successCount++
        const j = await r.json()
        if (!mountedRef.current) return
        setPendingCount(j.pending_count ?? null)
        setAttendRate(j.attendance_rate ?? null)
      } catch { /* timeout */ }
    }

    async function loadLeave() {
      try {
        const r = await apiFetch('/leave/balance')
        if (!r.ok) return
        successCount++
        const j = await r.json()
        const b = j.balance
        if (!mountedRef.current || !b) return
        setLeaveCl(b.cl_available ?? null)
        setLeaveSl(b.sl_available ?? null)
        setLeaveFy(b.fy_label ?? null)
      } catch { /* timeout */ }
    }

    try {
      // Cap spinner at FETCH_TIMEOUT_MS even if a fetch misbehaves
      await Promise.race([
        Promise.allSettled([loadMe(), loadEmployees(), loadVisits(), loadStats(), loadLeave()]),
        new Promise<void>(resolve => setTimeout(resolve, FETCH_TIMEOUT_MS + 500)),
      ])
    } finally {
      if (mountedRef.current) setRefreshing(false)
    }

    if (!mountedRef.current) return

    if (successCount === 0) {
      if (retryCountRef.current < 1) {
        retryCountRef.current += 1
        setBackendError('Backend is waking up (cold start). Retrying in 15 s…')
        setTimeout(() => { if (mountedRef.current) fetchAll(true) }, 15_000)
      } else {
        setBackendError('Unable to reach the backend. Check your connection and try Refresh.')
      }
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fmt = (v: number | null, suffix = '') =>
    v === null ? '—' : `${v}${suffix}`

  return (
    <div className="space-y-8">

      {backendError && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400">
          <WifiOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{backendError}</span>
        </div>
      )}

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Welcome back, {userName}
          </h1>
          <p className="text-muted-foreground text-sm">Here's your dealership overview for today</p>
        </div>
        <button
          onClick={() => fetchAll()}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-50"
        >
          <CheckCircle className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Employees"
          value={fmt(empCount)}
          change="All active employees"
          icon={Users}
          trend="neutral"
        />
        <StatCard
          label="Visits This Month"
          value={fmt(visitsMonth)}
          change="From visit reports"
          icon={TrendingUp}
          trend={visitsMonth !== null && visitsMonth > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          label="Pending Approvals"
          value={fmt(pendingCount)}
          change="Attendance awaiting review"
          icon={Clock}
          trend={pendingCount !== null && pendingCount > 0 ? 'down' : 'neutral'}
        />
        <StatCard
          label="Avg Attendance"
          value={fmt(attendRate, '%')}
          change="Current month"
          icon={CheckCircle}
          trend={attendRate !== null && attendRate >= 75 ? 'up' : attendRate !== null ? 'down' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <StatCard
          label={`Casual leave available${leaveFy ? ` · FY ${leaveFy}` : ''}`}
          value={fmt(leaveCl)}
          change="6 CL max per year · +1 every 2 months after probation"
          icon={CalendarDays}
          trend="neutral"
        />
        <StatCard
          label={`Sick leave available${leaveFy ? ` · FY ${leaveFy}` : ''}`}
          value={fmt(leaveSl)}
          change="Unused SL carries forward after financial year"
          icon={CalendarDays}
          trend="neutral"
        />
      </div>

      <ChartCard
        title="Visit Activity (Last 30 Days)"
        subtitle="Daily visit count from visit reports"
        data={chartData}
      />

    </div>
  )
}
