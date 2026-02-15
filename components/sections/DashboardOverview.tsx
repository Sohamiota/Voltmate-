import { ArrowUp, Users, TrendingUp, DollarSign, Calendar, Clock } from 'lucide-react'
import StatCard from '@/components/StatCard'
import RecentActivityCard from '@/components/RecentActivityCard'
import ChartCard from '@/components/ChartCard'

export default function DashboardOverview() {
  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Welcome back, Manager</h1>
        <p className="text-muted-foreground">Here's your dealership overview for today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Employees"
          value="156"
          change="+4 this month"
          icon={Users}
          trend="up"
        />
        <StatCard
          label="Sales This Month"
          value="$48,250"
          change="+12% vs last month"
          icon={DollarSign}
          trend="up"
        />
        <StatCard
          label="Active Tasks"
          value="23"
          change="5 due today"
          icon={Calendar}
          trend="neutral"
        />
        <StatCard
          label="Avg Attendance"
          value="94.2%"
          change="+2.1% this week"
          icon={Clock}
          trend="up"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard
            title="Sales Performance (Last 30 Days)"
            subtitle="Track your dealership sales trend"
          />
        </div>
        <div>
          <RecentActivityCard />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors cursor-pointer">
          <h3 className="font-semibold text-foreground mb-2">Add New Employee</h3>
          <p className="text-sm text-muted-foreground">Onboard a new team member</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors cursor-pointer">
          <h3 className="font-semibold text-foreground mb-2">Process Payroll</h3>
          <p className="text-sm text-muted-foreground">Run monthly payroll calculations</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors cursor-pointer">
          <h3 className="font-semibold text-foreground mb-2">View Reports</h3>
          <p className="text-sm text-muted-foreground">Access detailed analytics and reports</p>
        </div>
      </div>
    </div>
  )
}
