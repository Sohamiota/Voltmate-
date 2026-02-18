'use client'

import { LucideIcon, Zap } from 'lucide-react'
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
}

export default function Sidebar({
  sections,
  currentSection,
  setCurrentSection,
  isOpen,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setCurrentSection(currentSection)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 z-50 lg:z-auto',
          !isOpen && '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="px-6 py-8 border-b border-sidebar-border flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-lg">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-sidebar-foreground">Voltmate</h1>
            <p className="text-xs text-sidebar-accent-foreground">EMS</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                onClick={() => setCurrentSection(section.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                  currentSection === section.id
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{section.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-6 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-accent-foreground text-center">
            Voltmate v1.0
          </p>
        </div>
      </aside>
    </>
  )
}
