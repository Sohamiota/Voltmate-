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
  Menu,
  X,
  ArrowUp,
  Clock,
  UserCheck,
  Zap
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // fetch current user to determine role (if logged in)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      if (token) {
        get('/auth/me', token)
          .then((res: any) => {
            setUserRole(res.user?.role || null)
          })
          .catch(() => setUserRole(null))
      }
    } catch (e) {
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
  ]
  // if admin, add admin attendance entry
  if (userRole === 'admin') {
    sections.push({ id: 'admin-attendance', label: 'Admin Attendance', icon: UserCheck })
  }

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <DashboardOverview />
      case 'employees':
        return <EmployeeManagement role={userRole} />
      case 'sales':
        return <SalesPerformance />
      case 'payroll':
        return <PayrollSection />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <div className="p-8"><p className="text-muted-foreground">Settings coming soon</p></div>
      case 'attendance':
        // navigate to the attendance page
        router.push('/attendance')
        return null
      case 'admin-attendance':
        router.push('/admin/attendance')
        return null
      default:
        return <DashboardOverview />
    }
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <Sidebar 
        sections={sections}
        currentSection={currentSection}
        setCurrentSection={setCurrentSection}
        isOpen={sidebarOpen}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          isSidebarOpen={sidebarOpen}
        />
        
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  )
}
