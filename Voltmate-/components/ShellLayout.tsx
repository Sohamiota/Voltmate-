'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import { SearchProvider, useSearch } from '@/components/SearchContext'
import { getNavItemsForRole, resolveSectionFromPathname } from '@/lib/navigation'
import { getStoredToken, API_BASE } from '@/src/api/client'

interface Props {
  children: React.ReactNode
}

function ShellLayoutInner({ children }: Props) {
  const pathname = usePathname()
  const { clearQuery } = useSearch()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  const currentSection = resolveSectionFromPathname(pathname ?? '/')
  const sections = getNavItemsForRole(userRole)

  useEffect(() => {
    setSidebarOpen(false)
    clearQuery()
  }, [pathname, clearQuery])

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
          userRole={userRole}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function ShellLayout({ children }: Props) {
  return (
    <SearchProvider>
      <ShellLayoutInner>{children}</ShellLayoutInner>
    </SearchProvider>
  )
}
