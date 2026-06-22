'use client'

import { useEffect, useState } from 'react'
import EmployeeManagement from '@/components/sections/EmployeeManagement'
import { getStoredToken, API_BASE } from '@/src/api/client'

export default function EmployeesPage() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const token = getStoredToken()
    if (!token) return
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setRole(d?.user?.role ?? null))
      .catch(() => {})
  }, [])

  return (
    <div className="p-6 sm:p-8">
      <EmployeeManagement role={role} />
    </div>
  )
}
