'use client'

import { useState, useEffect } from 'react'
import { get } from '../src/api/client'
import {
  BarChart3,
  Users,
  TrendingUp,
  DollarSign,
  Calendar,
  Settings,
  Clock,
  UserCheck,
  Youtube,
  ClipboardList,
} from 'lucide-react'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import DashboardOverview from '@/components/sections/DashboardOverview'
import EmployeeManagement from '@/components/sections/EmployeeManagement'
import SalesPerformance from '@/components/sections/SalesPerformance'
import PayrollSection from '@/components/sections/PayrollSection'
import Analytics from '@/components/sections/Analytics'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [currentSection, setCurrentSection] = useState('dashboard')
  // Default closed — opens automatically on desktop via useEffect
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const router = useRouter()

  // Open sidebar by default on desktop screens
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setSidebarOpen(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      if (token) {
        get('/auth/me', token)
          .then((res: any) => setUserRole(res.user?.role || null))
          .catch(() => setUserRole(null))
      }
    } catch {
      setUserRole(null)
    }
  }, [])

  const sections = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'payroll', label: 'Payroll', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'task-manager', label: 'Task Manager', icon: ClipboardList },
    { id: 'vehicle-videos', label: 'Vehicle Videos', icon: Youtube },
  ]
  if (userRole === 'admin') {
    sections.push({ id: 'admin-attendance',   label: 'Admin Attendance',   icon: UserCheck })
    sections.push({ id: 'admin-task-manager', label: 'Admin Task Manager', icon: ClipboardList })
  }

  function handleSectionChange(id: string) {
    setCurrentSection(id)
    // Navigate for standalone pages
    if (id === 'attendance')      { router.push('/attendance');       return }
    if (id === 'admin-attendance'){ router.push('/admin/attendance'); return }
    if (id === 'task-manager')       { router.push('/task-manager');          return }
    if (id === 'admin-task-manager') { router.push('/admin/task-manager');    return }
    if (id === 'vehicle-videos')  { router.push('/vehicle-videos');   return }
  }

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':   return <DashboardOverview />
      case 'employees':   return <EmployeeManagement role={userRole} />
      case 'sales':       return <SalesPerformance />
      case 'payroll':     return <PayrollSection />
      case 'analytics':   return <Analytics />
      case 'settings':    return <div className="p-6 sm:p-8"><p className="text-muted-foreground text-sm">Settings coming soon</p></div>
      default:            return <DashboardOverview />
    }
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-secondary/10 overflow-hidden">
      <Sidebar
        sections={sections}
        currentSection={currentSection}
        setCurrentSection={handleSectionChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(prev => !prev)}
          isSidebarOpen={sidebarOpen}
        />

        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  )
}
