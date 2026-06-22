'use client'

import PageHeader from '@/components/PageHeader'
import { getBreadcrumbsForPath } from '@/lib/navigation'

export default function SettingsPage() {
  return (
    <div className="p-6 sm:p-8">
      <PageHeader
        title="Settings"
        description="Account and application preferences"
        breadcrumbs={getBreadcrumbsForPath('/settings')}
      />
      <p className="text-muted-foreground text-sm">Settings coming soon.</p>
    </div>
  )
}
