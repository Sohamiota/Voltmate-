'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import { getNavItemsForRole, resolveSectionFromPathname } from '@/lib/navigation'
import { getStoredToken, API_BASE } from '@/src/api/client'

interface Props {
  children: React.ReactNode
}

export default function ShellLayout({ children }: Props) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  const currentSection = resolveSectionFromPathname(pathname ?? '/')
  const sections = getNavItemsForRole(userRole)

  // Open sidebar by default on desktop; stay closed on mobile
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setSidebarOpen(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const token = getStoredToken()
    if (!token) return
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setUserRole(d?.user?.role ?? null))
      .catch(() => {})
  }, [])

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-secondary/10 overflow-hidden">
      <Sidebar
        sections={sections}
        currentSection={currentSection}
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
