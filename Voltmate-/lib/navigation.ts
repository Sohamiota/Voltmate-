import {
  BarChart3,
  Calendar,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  LucideIcon,
  Settings,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
  Youtube,
} from 'lucide-react'

export type NavRole = 'admin' | 'attendance_admin' | 'sales_admin' | string | null

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  route: string
  /** If set, user must have one of these roles to see the item. */
  roles?: string[]
}

/** Base nav items visible to all authenticated users. */
export const BASE_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',       label: 'Dashboard',       icon: BarChart3,     route: '/' },
  { id: 'employees',       label: 'Employees',       icon: Users,         route: '/employees' },
  { id: 'sales',           label: 'Sales',           icon: TrendingUp,    route: '/sales' },
  { id: 'payroll',         label: 'Payroll',         icon: DollarSign,    route: '/payroll' },
  { id: 'analytics',       label: 'Analytics',       icon: Calendar,      route: '/analytics' },
  { id: 'settings',        label: 'Settings',        icon: Settings,      route: '/settings' },
  { id: 'attendance',      label: 'Attendance',      icon: Clock,         route: '/attendance' },
  { id: 'task-manager',    label: 'Task Manager',    icon: ClipboardList, route: '/task-manager' },
  { id: 'billing',         label: 'Billing',         icon: FileText,      route: '/billing' },
  { id: 'vehicle-videos',  label: 'Vehicle Videos',  icon: Youtube,       route: '/vehicle-videos' },
  { id: 'service-manager', label: 'Service Manager', icon: Wrench,        route: '/service-manager' },
]

export const ROLE_NAV_ITEMS: NavItem[] = [
  { id: 'admin-attendance',   label: 'Admin Attendance',   icon: UserCheck,     route: '/admin/attendance',   roles: ['admin', 'attendance_admin'] },
  { id: 'admin-leave',        label: 'Leave Approvals',    icon: Calendar,      route: '/admin/leave',        roles: ['admin', 'attendance_admin'] },
  { id: 'admin-task-manager', label: 'Admin Task Manager', icon: ClipboardList, route: '/admin/task-manager', roles: ['admin', 'sales_admin'] },
  { id: 'sales-analytics',    label: 'Sales Analytics',    icon: BarChart3,     route: '/admin/sales-analytics', roles: ['admin'] },
]

/** Maps exact or nested pathnames to sidebar section IDs (longest match wins). */
const PATH_PREFIX_TO_SECTION: Array<{ prefix: string; section: string }> = [
  { prefix: '/admin/sales-analytics', section: 'sales-analytics' },
  { prefix: '/admin/daily-target',    section: 'sales-analytics' },
  { prefix: '/admin/overdue-visits',  section: 'sales-analytics' },
  { prefix: '/admin/sales-location',  section: 'sales-analytics' },
  { prefix: '/admin/attendance',      section: 'admin-attendance' },
  { prefix: '/admin/leave',           section: 'admin-leave' },
  { prefix: '/admin/task-manager',    section: 'admin-task-manager' },
  { prefix: '/service-manager',       section: 'service-manager' },
  { prefix: '/sales',                 section: 'sales' },
  { prefix: '/employees',             section: 'employees' },
  { prefix: '/payroll',               section: 'payroll' },
  { prefix: '/analytics',             section: 'analytics' },
  { prefix: '/settings',              section: 'settings' },
  { prefix: '/attendance',            section: 'attendance' },
  { prefix: '/task-manager',          section: 'task-manager' },
  { prefix: '/billing',               section: 'billing' },
  { prefix: '/vehicle-videos',        section: 'vehicle-videos' },
  { prefix: '/',                      section: 'dashboard' },
]

/** Human-readable page titles for breadcrumbs. */
export const ROUTE_LABELS: Record<string, string> = {
  '/':                          'Dashboard',
  '/employees':                 'Employees',
  '/sales':                     'Sales',
  '/payroll':                   'Payroll',
  '/analytics':                 'Analytics',
  '/settings':                  'Settings',
  '/attendance':                'Attendance',
  '/task-manager':              'Task Manager',
  '/billing':                   'Billing',
  '/vehicle-videos':            'Vehicle Videos',
  '/service-manager':           'Service Manager',
  '/service-manager/vehicles':  'Vehicle Management',
  '/admin/attendance':          'Admin Attendance',
  '/admin/leave':               'Leave Approvals',
  '/admin/task-manager':        'Admin Task Manager',
  '/admin/sales-analytics':     'Sales Analytics',
  '/admin/daily-target':        'Weekly Team Report',
  '/admin/overdue-visits':      'Overdue Visits',
  '/admin/sales-location':      'Sales Rep Location',
  '/sales/lead-report':         'Lead Report',
  '/sales/visit-report':        'Visit Report',
  '/sales/create-lead-report':  'Lead Management',
  '/sales/create-visit-report': 'Visit Management',
}

/** Parent route for back navigation and breadcrumb hierarchy. */
export const ROUTE_PARENTS: Record<string, string> = {
  '/employees':                 '/',
  '/sales':                     '/',
  '/payroll':                   '/',
  '/analytics':                 '/',
  '/settings':                  '/',
  '/attendance':                '/',
  '/task-manager':              '/',
  '/billing':                   '/',
  '/vehicle-videos':            '/',
  '/service-manager':           '/',
  '/service-manager/vehicles':  '/service-manager',
  '/sales/lead-report':         '/sales',
  '/sales/visit-report':        '/sales',
  '/sales/create-lead-report':  '/sales',
  '/sales/create-visit-report': '/sales',
  '/admin/attendance':          '/',
  '/admin/leave':               '/',
  '/admin/task-manager':        '/',
  '/admin/sales-analytics':     '/',
  '/admin/daily-target':        '/admin/sales-analytics',
  '/admin/overdue-visits':      '/admin/sales-analytics',
  '/admin/sales-location':      '/admin/attendance',
}

export function getNavItemsForRole(role: NavRole): NavItem[] {
  const items = [...BASE_NAV_ITEMS]
  for (const item of ROLE_NAV_ITEMS) {
    if (!item.roles || (role && item.roles.includes(role))) {
      items.push(item)
    }
  }
  return items
}

export function resolveSectionFromPathname(pathname: string): string {
  const path = pathname || '/'
  for (const { prefix, section } of PATH_PREFIX_TO_SECTION) {
    if (prefix === '/') {
      if (path === '/') return section
      continue
    }
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return section
    }
  }
  return 'dashboard'
}

export function getRouteLabel(pathname: string): string {
  return ROUTE_LABELS[pathname] ?? pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ?? 'Page'
}

export function getBackNavigation(pathname: string): { href: string; label: string } | null {
  const parent = ROUTE_PARENTS[pathname]
  if (!parent) return null
  return { href: parent, label: getRouteLabel(parent) }
}

export interface BreadcrumbEntry {
  href: string
  label: string
}

/** Build breadcrumb trail from root to current page. */
export function getBreadcrumbsForPath(pathname: string): BreadcrumbEntry[] {
  const crumbs: BreadcrumbEntry[] = []
  let current = pathname || '/'
  const seen = new Set<string>()

  while (current && !seen.has(current)) {
    seen.add(current)
    crumbs.unshift({ href: current, label: getRouteLabel(current) })
    const parent = ROUTE_PARENTS[current]
    if (!parent || parent === current) break
    current = parent
  }

  return crumbs
}

export const DESKTOP_BREAKPOINT_PX = 1024

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < DESKTOP_BREAKPOINT_PX
}
