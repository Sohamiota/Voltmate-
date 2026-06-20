'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
  Wrench,
  FileText,
} from 'lucide-react'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import { getStoredToken, API_BASE } from '@/src/api/client'

// Maps URL pathnames to sidebar section IDs for active-item highlighting.
const PATHNAME_TO_SECTION: Record<string, string> = {
  '/':                          'dashboard',
  '/attendance':                'attendance',
  '/task-manager':              'task-manager',
  '/billing':                   'billing',
  '/vehicle-videos':            'vehicle-videos',
  '/service-manager':           'service-manager',
  '/service-manager/vehicles':  'service-manager',
  '/admin/attendance':          'admin-attendance',
  '/admin/leave':               'admin-leave',
  '/admin/task-manager':        'admin-task-manager',
  '/admin/sales-analytics':     'sales-analytics',
  '/admin/daily-target':        'sales-analytics',
  '/admin/overdue-visits':      'sales-analytics',
  '/admin/sales-location':      'sales-analytics',
  '/sales/lead-report':         'sales',
  '/sales/visit-report':        'sales',
  '/sales/create-lead-report':  'sales',
  '/sales/create-visit-report': 'sales',
}

// Maps section IDs to the route to navigate to when the item is clicked.
const SECTION_TO_ROUTE: Record<string, string> = {
  dashboard:          '/',
  employees:          '/',
  sales:              '/',
  payroll:            '/',
  analytics:          '/',
  settings:           '/',
  attendance:         '/attendance',
  'task-manager':     '/task-manager',
  billing:            '/billing',
  'vehicle-videos':   '/vehicle-videos',
  'service-manager':  '/service-manager',
  'admin-attendance': '/admin/attendance',
  'admin-leave':      '/admin/leave',
  'admin-task-manager': '/admin/task-manager',
  'sales-analytics':  '/admin/sales-analytics',
}

interface Props {
  children: React.ReactNode
}

export default function ShellLayout({ children }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userRole,    setUserRole]    = useState<string | null>(null)

  // Determine the active sidebar item from the current URL
  const currentSection = PATHNAME_TO_SECTION[pathname ?? '/'] ?? 'dashboard'

  // Open sidebar by default on desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setSidebarOpen(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Fetch role so admin-only nav items appear
  useEffect(() => {
    const token = getStoredToken()
    if (!token) return
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setUserRole(d?.user?.role ?? null))
      .catch(() => {})
  }, [])

  const sections = [
    { id: 'dashboard',       label: 'Dashboard',       icon: BarChart3   },
    { id: 'employees',       label: 'Employees',       icon: Users       },
    { id: 'sales',           label: 'Sales',           icon: TrendingUp  },
    { id: 'payroll',         label: 'Payroll',         icon: DollarSign  },
    { id: 'analytics',       label: 'Analytics',       icon: Calendar    },
    { id: 'settings',        label: 'Settings',        icon: Settings    },
    { id: 'attendance',      label: 'Attendance',      icon: Clock       },
    { id: 'task-manager',    label: 'Task Manager',    icon: ClipboardList },
    { id: 'billing',         label: 'Billing',         icon: FileText    },
    { id: 'vehicle-videos',  label: 'Vehicle Videos',  icon: Youtube     },
    { id: 'service-manager', label: 'Service Manager', icon: Wrench      },
  ]

  if (userRole === 'admin' || userRole === 'attendance_admin') {
    sections.push({ id: 'admin-attendance', label: 'Admin Attendance', icon: UserCheck   })
    sections.push({ id: 'admin-leave',      label: 'Leave Approvals',  icon: Calendar    })
  }
  if (userRole === 'admin' || userRole === 'sales_admin') {
    sections.push({ id: 'admin-task-manager', label: 'Admin Task Manager', icon: ClipboardList })
  }
  if (userRole === 'admin') {
    sections.push({ id: 'sales-analytics', label: 'Sales Analytics', icon: BarChart3 })
  }

  function handleSectionChange(id: string) {
    const route = SECTION_TO_ROUTE[id] ?? '/'
    router.push(route)
    setSidebarOpen(false)
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
          {children}
        </main>
      </div>
    </div>
  )
}
