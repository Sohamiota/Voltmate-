'use client'

import Link from 'next/link'
import { LucideIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isMobileViewport } from '@/lib/navigation'

export interface SidebarSection {
  id: string
  label: string
  icon: LucideIcon
  route: string
}

interface SidebarProps {
  sections: SidebarSection[]
  currentSection: string
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({
  sections,
  currentSection,
  isOpen,
  onClose,
}: SidebarProps) {
  function handleNavClick() {
    if (isMobileViewport()) onClose()
  }

  return (
    <>
      {/* Overlay on mobile only — tap outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel — slide-over drawer; collapsible on all screen sizes */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="px-4 py-5 border-b border-sidebar-border flex items-center justify-between gap-2 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 min-w-0" onClick={handleNavClick}>
            <img
              src="/voltmate-logo.svg"
              alt="Voltmate"
              className="h-9 w-auto max-w-[140px] object-contain flex-shrink-0"
            />
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = currentSection === section.id
            return (
              <Link
                key={section.id}
                href={section.route}
                onClick={handleNavClick}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 text-left',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">{section.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
