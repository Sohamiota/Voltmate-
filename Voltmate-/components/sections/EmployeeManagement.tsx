import { Search, Plus, MoreVertical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { get } from '@/src/api/client'

type Employee = {
  id: number
  name: string
  email: string
  role: string | null
  is_verified: boolean
  is_approved: boolean
  created_at: string
}

type Props = {
  role?: string | null
}

export default function EmployeeManagement({ role }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
        const res: any = await get('/employees', token || undefined)
        setEmployees(res.employees || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load employees')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])
  return (
    <div className="space-y-6">
      {/* Header — wraps on mobile */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Employee Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your team members and their information</p>
        </div>
        <button className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground px-4 py-2 sm:px-6 sm:py-3 rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all font-semibold text-sm">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
        <div className="flex items-center gap-3 bg-secondary border border-border rounded-lg px-3 sm:px-4 py-2">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search employees by name, role..."
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder-muted-foreground text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 560 }}>
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 font-semibold text-foreground text-sm">Name</th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 font-semibold text-foreground text-sm">Email</th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 font-semibold text-foreground text-sm">Role</th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 font-semibold text-foreground text-sm">Status</th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 font-semibold text-foreground text-sm hidden sm:table-cell">Joined</th>
                <th className="text-center px-4 sm:px-6 py-3 sm:py-4 font-semibold text-foreground text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-sm">Loading...</td></tr>
              )}
              {error && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-red-400 text-sm">{error}</td></tr>
              )}
              {!loading && !error && employees.map((employee, index) => (
                <tr key={employee.id} className={index !== employees.length - 1 ? 'border-b border-border' : ''}>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-foreground font-medium text-sm">{employee.name}</td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-muted-foreground text-sm max-w-[160px] truncate">{role === 'admin' ? employee.email : 'Hidden'}</td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-muted-foreground text-sm capitalize">{employee.role || 'employee'}</td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${employee.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {employee.is_approved ? 'Active' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-muted-foreground text-sm hidden sm:table-cell">
                    {new Date(employee.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                    <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
