import { DollarSign, Calendar, CheckCircle, AlertCircle } from 'lucide-react'

const payrollData = [
  { id: 1, name: 'John Doe', salary: 4500, bonus: 500, deductions: 450, netPay: 4550, status: 'Paid' },
  { id: 2, name: 'Sarah Smith', salary: 5200, bonus: 800, deductions: 520, netPay: 5480, status: 'Paid' },
  { id: 3, name: 'Mike Johnson', salary: 4800, bonus: 400, deductions: 480, netPay: 4720, status: 'Pending' },
  { id: 4, name: 'Emma Wilson', salary: 4200, bonus: 300, deductions: 420, netPay: 4080, status: 'On Leave' },
  { id: 5, name: 'David Brown', salary: 3500, bonus: 200, deductions: 350, netPay: 3350, status: 'Paid' },
]

export default function PayrollSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payroll Management</h1>
          <p className="text-muted-foreground">Manage employee salaries and payments</p>
        </div>
        <button className="bg-gradient-to-r from-primary to-secondary text-primary-foreground px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all font-semibold">
          Process Payroll
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">Total Payroll</p>
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">$22,180</p>
          <p className="text-xs text-muted-foreground mt-2">This month</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">Bonuses</p>
            <DollarSign className="w-5 h-5 text-secondary" />
          </div>
          <p className="text-2xl font-bold text-foreground">$2,200</p>
          <p className="text-xs text-muted-foreground mt-2">Performance based</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">Paid</p>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">3/5</p>
          <p className="text-xs text-muted-foreground mt-2">Employees</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <AlertCircle className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">2/5</p>
          <p className="text-xs text-muted-foreground mt-2">Employees</p>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Current Payroll</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            February 2025
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Employee</th>
                <th className="text-right px-6 py-4 font-semibold text-foreground">Base Salary</th>
                <th className="text-right px-6 py-4 font-semibold text-foreground">Bonus</th>
                <th className="text-right px-6 py-4 font-semibold text-foreground">Deductions</th>
                <th className="text-right px-6 py-4 font-semibold text-foreground">Net Pay</th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {payrollData.map((employee, index) => (
                <tr key={employee.id} className={index !== payrollData.length - 1 ? 'border-b border-border' : ''}>
                  <td className="px-6 py-4 font-medium text-foreground">{employee.name}</td>
                  <td className="px-6 py-4 text-right text-foreground">${employee.salary.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-green-400">${employee.bonus.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-red-400">-${employee.deductions.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-primary font-semibold">${employee.netPay.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      employee.status === 'Paid'
                        ? 'bg-green-500/20 text-green-400'
                        : employee.status === 'Pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {employee.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-border bg-secondary">
          <div className="flex justify-end items-center gap-8 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Total Payroll</p>
              <p className="text-xl font-bold text-foreground">$22,180</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
