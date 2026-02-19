'use client'

import { LucideIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Section {
  id: string
  label: string
  icon: LucideIcon
}

interface SidebarProps {
  sections: Section[]
  currentSection: string
  setCurrentSection: (section: string) => void
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({
  sections,
  currentSection,
  setCurrentSection,
  isOpen,
  onClose,
}: SidebarProps) {
  function handleNavClick(id: string) {
    setCurrentSection(id)
    // Always close sidebar after selection (on mobile it collapses, on desktop user can re-open)
    onClose()
  }

  return (
    <>
      {/* Overlay — covers content when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo + close button */}
        <div className="px-4 py-5 border-b border-sidebar-border flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <img
              src="/voltmate-logo.svg"
              alt="Voltmate"
              className="h-8 w-auto"
              style={{ maxWidth: 140 }}
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                onClick={() => handleNavClick(section.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 text-left',
                  currentSection === section.id
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent active:bg-sidebar-accent'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">{section.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-sidebar-border flex-shrink-0">
          <p className="text-xs text-sidebar-accent-foreground text-center">Voltmate v1.0</p>
        </div>
      </aside>
    </>
  )
}
