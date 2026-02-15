import { Search, Plus, MoreVertical, Badge } from 'lucide-react'

const employees = [
  { id: 1, name: 'John Doe', position: 'Sales Manager', department: 'Sales', status: 'Active', joinDate: '2023-01-15' },
  { id: 2, name: 'Sarah Smith', position: 'Senior Sales', department: 'Sales', status: 'Active', joinDate: '2022-06-20' },
  { id: 3, name: 'Mike Johnson', position: 'Service Manager', department: 'Service', status: 'Active', joinDate: '2023-03-10' },
  { id: 4, name: 'Emma Wilson', position: 'HR Specialist', department: 'HR', status: 'On Leave', joinDate: '2023-05-01' },
  { id: 5, name: 'David Brown', position: 'Sales Executive', department: 'Sales', status: 'Active', joinDate: '2024-01-08' },
]

export default function EmployeeManagement() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Management</h1>
          <p className="text-muted-foreground">Manage your team members and their information</p>
        </div>
        <button className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all font-semibold">
          <Plus className="w-5 h-5" />
          Add Employee
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 bg-secondary border border-border rounded-lg px-4 py-2">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employees by name, position..."
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder-muted-foreground"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Name</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Position</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Department</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Join Date</th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee, index) => (
                <tr key={employee.id} className={index !== employees.length - 1 ? 'border-b border-border' : ''}>
                  <td className="px-6 py-4 text-foreground font-medium">{employee.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{employee.position}</td>
                  <td className="px-6 py-4 text-muted-foreground">{employee.department}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      employee.status === 'Active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{employee.joinDate}</td>
                  <td className="px-6 py-4 text-center">
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
