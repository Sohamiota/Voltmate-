'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import StatCard from '@/components/StatCard'
import RecentActivityCard from '@/components/RecentActivityCard'
import ChartCard from '@/components/ChartCard'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '')

function tok() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('auth_token') || localStorage.getItem('token') || ''
}

function authHdr() {
  return { Authorization: `Bearer ${tok()}` }
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
  const [chartData,     setChartData]     = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Who's logged in
      const meRes = await fetch(`${API_BASE}/api/v1/auth/me`, { headers: authHdr() })
      if (meRes.ok) {
        const mj = await meRes.json()
        const n = mj.user?.name || mj.user?.email || 'Manager'
        setUserName(n.split(' ')[0]) // first name only
      }

      // 2. Employee count
      const empRes = await fetch(`${API_BASE}/api/v1/auth/employees`, { headers: authHdr() })
      if (empRes.ok) {
        const ej = await empRes.json()
        setEmpCount((ej.employees || []).length)
      }

      // 3. Visits this month (proxy for "Sales This Month")
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const visitsRes = await fetch(
        `${API_BASE}/api/v1/visits?limit=500`,
        { headers: authHdr() }
      )
      let allVisits: any[] = []
      if (visitsRes.ok) {
        const vj = await visitsRes.json()
        allVisits = vj.visits || []
        const monthVisits = allVisits.filter(v =>
          (v.visit_date || '').slice(0, 10) >= monthStart
        )
        setVisitsMonth(monthVisits.length)
      }
      setChartData(buildDailySales(allVisits, 30))

      // 4. Attendance stats (pending + rate)
      const statsRes = await fetch(`${API_BASE}/api/v1/attendance/stats`, { headers: authHdr() })
      if (statsRes.ok) {
        const sj = await statsRes.json()
        setPendingCount(sj.pending_count ?? null)
        setAttendRate(sj.attendance_rate ?? null)
      }
    } catch (e) {
      console.error('Dashboard fetch error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fmt = (v: number | null, suffix = '') =>
    loading ? '…' : v === null ? '—' : `${v}${suffix}`

  return (
    <div className="space-y-8">

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
