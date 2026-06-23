import { Search, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { get, post, patch } from '@/src/api/client'
import { useEffectiveSearch } from '@/components/SearchContext'

const ROLES = ['employee', 'sales_admin', 'attendance_admin', 'admin', 'sales', 'service'] as const
type RoleValue = typeof ROLES[number]

const ROLE_LABELS: Record<RoleValue, string> = {
  employee:          'Employee',
  sales_admin:       'Sales Admin',
  attendance_admin:  'Attendance Admin',
  admin:             'Admin',
  sales:             'Sales',
  service:           'Service',
}

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

const EMPTY_FORM = { name: '', email: '', password: '', role: 'employee' as RoleValue }

export default function EmployeeManagement({ role }: Props) {
  const [employees, setEmployees]       = useState<Employee[]>([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [actingId, setActingId]         = useState<number | null>(null)
  const [roleActingId, setRoleActingId] = useState<number | null>(null)
  const [showModal, setShowModal]       = useState(false)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [formBusy, setFormBusy]         = useState(false)
  const [formError, setFormError]       = useState<string | null>(null)
  const [search, setSearch]             = useState('')

  async function loadEmployees() {
    setLoading(true)
    setError(null)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const path = role === 'admin' ? '/employees?full_roster=1' : '/employees'
      const res: any = await get(path, token || undefined)
      setEmployees(res.employees || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadEmployees() }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  async function approveRegistration(userId: number) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (!token) return
    setActingId(userId)
    try {
      await post(`/auth/admin/users/${userId}/approve`, {}, token)
      await loadEmployees()
    } catch (e: any) {
      alert(e?.message || 'Approve failed')
    } finally {
      setActingId(null)
    }
  }

  async function changeRole(userId: number, newRole: RoleValue) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (!token) return
    if (!confirm(`Change role to "${ROLE_LABELS[newRole]}"?`)) return
    setRoleActingId(userId)
    try {
      await patch(`/auth/admin/users/${userId}/role`, { role: newRole }, token)
      setEmployees(prev => prev.map(e => e.id === userId ? { ...e, role: newRole } : e))
    } catch (e: any) {
      alert(e?.message || 'Role change failed')
    } finally {
      setRoleActingId(null)
    }
  }

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault()
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (!token) return
    setFormBusy(true)
    setFormError(null)
    try {
      await post('/auth/admin/users', form, token)
      setShowModal(false)
      setForm(EMPTY_FORM)
      await loadEmployees()
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create account')
    } finally {
      setFormBusy(false)
    }
  }

  function statusLabel(e: Employee): string {
    if (!e.is_verified) return 'Awaiting email verification'
    if (!e.is_approved) return 'Pending admin approval'
    return 'Active'
  }

  function statusClass(e: Employee): string {
    if (!e.is_verified) return 'bg-slate-500/20 text-slate-300'
    if (!e.is_approved) return 'bg-yellow-500/20 text-yellow-400'
    return 'bg-green-500/20 text-green-400'
  }
  const effectiveSearch = useEffectiveSearch(search)
  const filtered = employees.filter(e => {
    if (!effectiveSearch) return true
    const q = effectiveSearch.toLowerCase()
    return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || (e.role || '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Employee Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your team members and their information</p>
        </div>
        {role === 'admin' && (
          <button
            onClick={() => { setShowModal(true); setFormError(null); setForm(EMPTY_FORM) }}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground px-4 py-2 sm:px-6 sm:py-3 rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all font-semibold text-sm"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Add Employee</span>
          </button>
        )}
      </div>

      {/* Create Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Add New Employee</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={createEmployee} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Full Name</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Saheb Banerjee"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="e.g. saheb@example.com"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Password</label>
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Set a login password"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as RoleValue }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {formError && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{formError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formBusy}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground disabled:opacity-50 hover:shadow-lg transition-all"
                >
                  {formBusy ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
        <div className="flex items-center gap-3 bg-secondary border border-border rounded-lg px-3 sm:px-4 py-2">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employees by name, email, role…"
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
              {!loading && !error && filtered.map((employee, index) => (
                <tr key={employee.id} className={index !== employees.length - 1 ? 'border-b border-border' : ''}>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-foreground font-medium text-sm">{employee.name}</td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-muted-foreground text-sm max-w-[160px] truncate">{role === 'admin' ? employee.email : 'Hidden'}</td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm">
                    {role === 'admin' && employee.is_approved ? (
                      <select
                        value={employee.role || 'employee'}
                        disabled={roleActingId === employee.id}
                        onChange={e => changeRole(employee.id, e.target.value as RoleValue)}
                        className="bg-secondary border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-50 cursor-pointer"
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted-foreground capitalize">{employee.role || 'employee'}</span>
                    )}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClass(employee)}`}>
                      {statusLabel(employee)}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-muted-foreground text-sm hidden sm:table-cell">
                    {new Date(employee.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                    {role === 'admin' && employee.is_verified && !employee.is_approved ? (
                      <button
                        type="button"
                        disabled={actingId === employee.id}
                        onClick={() => approveRegistration(employee.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 border border-green-500/40 hover:bg-green-600/30 disabled:opacity-50"
                      >
                        {actingId === employee.id ? '…' : 'Approve'}
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
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
