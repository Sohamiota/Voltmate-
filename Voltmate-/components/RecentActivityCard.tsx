 'use client'

import { Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { get } from '@/src/api/client'

type Activity = {
  id: number
  type?: string
  title?: string
  description?: string
  text?: string
  created_at?: string
  time?: string
}

export default function RecentActivityCard() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
        // Try fetching real activity if backend provides it; otherwise leave empty
        const res: any = await get('/activity', token || undefined).catch(() => ({ activities: [] }))
        setActivities(res.activities || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load activity')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-4">Recent Activity</h2>

      <div className="space-y-4">
        {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}
        {!loading && activities.length === 0 && !error && (
          <div className="text-sm text-muted-foreground">No recent activity</div>
        )}
        {activities.map((activity) => (
          <div key={`${activity.type || 't'}-${activity.id}`} className="flex gap-4 pb-4 border-b border-border last:border-b-0 last:pb-0">
            <div className="p-2 bg-primary/10 rounded-lg h-fit">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground text-sm">{activity.title || activity.text || 'Activity'}</p>
              <p className="text-xs text-muted-foreground">{activity.description || activity.text || ''}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <Clock className="w-3 h-3" />
                {activity.time || activity.created_at || ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 text-primary text-sm font-semibold hover:bg-primary/10 rounded-lg transition-colors">
        View All Activity
      </button>
    </div>
  )
}
