'use client'

import { Menu, X, Bell, User } from 'lucide-react'

interface HeaderProps {
  onMenuClick: () => void
  isSidebarOpen: boolean
}

export default function Header({ onMenuClick, isSidebarOpen }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border flex-shrink-0">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        {/* Left: toggle button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {isSidebarOpen ? (
              <X className="w-5 h-5 text-primary" />
            ) : (
              <Menu className="w-5 h-5 text-primary" />
            )}
          </button>

          {/* Brand name shown when sidebar is closed */}
          {!isSidebarOpen && (
            <span className="text-sm font-semibold text-foreground hidden sm:block">Voltmate</span>
          )}
        </div>

        {/* Right: search + actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search — hidden on small screens */}
          <div className="hidden md:flex items-center">
            <input
              type="text"
              placeholder="Search..."
              className="px-3 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm w-40 lg:w-56"
            />
          </div>

          <button
            className="p-2 hover:bg-secondary rounded-lg transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-primary" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full"></span>
          </button>

          <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-primary/50 transition-shadow flex-shrink-0">
            <User className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
      </div>
    </header>
  )
}
