import { DollarSign, Calendar } from 'lucide-react'

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

      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-sm text-muted-foreground">No payroll data available</p>
      </div>
    </div>
  )
}
