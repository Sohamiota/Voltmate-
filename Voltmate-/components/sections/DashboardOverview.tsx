'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, TrendingUp, Clock, CheckCircle, CalendarDays, WifiOff } from 'lucide-react'
import StatCard from '@/components/StatCard'
import RecentActivityCard from '@/components/RecentActivityCard'
import ChartCard from '@/components/ChartCard'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '')

// Timeout for each individual request. 20 s covers a Render cold-start.
const FETCH_TIMEOUT_MS = 20_000

function tok() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('auth_token') || ''
}

function authHdr(): Record<string, string> {
  return { Authorization: `Bearer ${tok()}` }
}

/** fetch() wrapper that aborts after FETCH_TIMEOUT_MS */
function apiFetch(url: string) {
  return fetch(url, {
    headers: authHdr(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
}

// Build an array of {name, sales} for each day in the last N days
function buildDailySales(visits: any[], days = 30) {
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
  const [userName,      setUserName]      = useState('Manager')
  const [empCount,      setEmpCount]      = useState<number | null>(null)
  const [visitsMonth,   setVisitsMonth]   = useState<number | null>(null)
  const [pendingCount,  setPendingCount]  = useState<number | null>(null)
  const [attendRate,    setAttendRate]    = useState<number | null>(null)
  const [leaveCl,       setLeaveCl]       = useState<number | null>(null)
  const [leaveSl,       setLeaveSl]       = useState<number | null>(null)
  const [leaveFy,       setLeaveFy]       = useState<string | null>(null)
  const [chartData,     setChartData]     = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)
  const [backendError,  setBackendError]  = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setBackendError(null)

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const since30 = new Date(now)
    since30.setDate(now.getDate() - 30)
    const since30Str = since30.toISOString().slice(0, 10)

    // Fire all 5 requests in parallel — a slow/cold backend won't block
    // individual cards from rendering as soon as their own data arrives.
    const [meResult, empResult, visitsResult, statsResult, leaveResult] =
      await Promise.allSettled([
        apiFetch(`${API_BASE}/api/v1/auth/me`),
        apiFetch(`${API_BASE}/api/v1/auth/employees`),
        apiFetch(`${API_BASE}/api/v1/visits?limit=1000&visit_date_from=${since30Str}`),
        apiFetch(`${API_BASE}/api/v1/attendance/stats`),
        apiFetch(`${API_BASE}/api/v1/leave/balance`),
      ])

    // Track how many endpoints actually responded so we can show an error
    // banner if the backend is completely unreachable.
    let successCount = 0

    // 1. Who's logged in
    if (meResult.status === 'fulfilled' && meResult.value.ok) {
      successCount++
      const mj = await meResult.value.json()
      const n = mj.user?.name || mj.user?.email || 'Manager'
      setUserName(n.split(' ')[0])
    }

    // 2. Employee count
    if (empResult.status === 'fulfilled' && empResult.value.ok) {
      successCount++
      const ej = await empResult.value.json()
      setEmpCount((ej.employees || []).length)
    }

    // 3. Visits this month + chart
    let allVisits: any[] = []
    if (visitsResult.status === 'fulfilled' && visitsResult.value.ok) {
      successCount++
      const vj = await visitsResult.value.json()
      allVisits = vj.visits || []
      const monthVisits = allVisits.filter(v =>
        (v.visit_date || '').slice(0, 10) >= monthStart
      )
      setVisitsMonth(monthVisits.length)
    }
    setChartData(buildDailySales(allVisits, 30))

    // 4. Attendance stats
    if (statsResult.status === 'fulfilled' && statsResult.value.ok) {
      successCount++
      const sj = await statsResult.value.json()
      setPendingCount(sj.pending_count ?? null)
      setAttendRate(sj.attendance_rate ?? null)
    }

    // 5. Leave balance
    if (leaveResult.status === 'fulfilled' && leaveResult.value.ok) {
      successCount++
      const lj = await leaveResult.value.json()
      const b = lj.balance
      if (b) {
        setLeaveCl(b.cl_available ?? null)
        setLeaveSl(b.sl_available ?? null)
        setLeaveFy(b.fy_label ?? null)
      }
    }

    // Show a banner if every request failed (backend down / cold-starting)
    if (successCount === 0) {
      const isTimeout = [meResult, empResult, visitsResult, statsResult, leaveResult]
        .some(r => r.status === 'rejected' && (r.reason as Error)?.name === 'TimeoutError')
      setBackendError(
        isTimeout
          ? 'Backend is waking up (cold start). Retrying in 15 s…'
          : 'Unable to reach the backend. Check your connection and try again.'
      )
      // Auto-retry once after 15 s for cold-start scenario
      if (isTimeout) setTimeout(fetchAll, 15_000)
    }

    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fmt = (v: number | null, suffix = '') =>
    loading ? '…' : v === null ? '—' : `${v}${suffix}`

  return (
    <div className="space-y-8">

      {/* Backend unreachable / cold-start banner */}
      {backendError && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400">
          <WifiOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{backendError}</span>
        </div>
      )}

      {/* Welcome Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Welcome back, {loading ? '…' : userName}
          </h1>
          <p className="text-muted-foreground text-sm">Here's your dealership overview for today</p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          <CheckCircle className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Stats Grid */}
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

      {/* Leave balance */}
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

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard
            title="Visit Activity (Last 30 Days)"
            subtitle="Daily visit count from visit reports"
            data={chartData}
          />
        </div>
        <div>
          <RecentActivityCard />
        </div>
      </div>

    </div>
  )
}
