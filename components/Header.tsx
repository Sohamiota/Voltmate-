import { Menu, Bell, User } from 'lucide-react'

interface HeaderProps {
  onMenuClick: () => void
  isSidebarOpen: boolean
}

export default function Header({ onMenuClick, isSidebarOpen }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border">
      <div className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-secondary rounded-lg transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-primary" />
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center">
            <input
              type="text"
              placeholder="Search employees, sales..."
              className="px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-secondary rounded-lg transition-colors relative">
              <Bell className="w-5 h-5 text-primary" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
            </button>

            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-primary/50 transition-shadow">
              <User className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
