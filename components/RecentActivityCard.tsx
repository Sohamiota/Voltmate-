import { Clock, UserPlus, TrendingUp, DollarSign } from 'lucide-react'

const activities = [
  {
    id: 1,
    type: 'employee',
    title: 'New Employee',
    description: 'John Doe joined as Sales Manager',
    time: '2 hours ago',
    icon: UserPlus,
  },
  {
    id: 2,
    type: 'sales',
    title: 'High Sales',
    description: 'Sarah made a $5,500 sale',
    time: '4 hours ago',
    icon: TrendingUp,
  },
  {
    id: 3,
    type: 'payroll',
    title: 'Payroll Processed',
    description: 'Monthly payroll completed',
    time: '1 day ago',
    icon: DollarSign,
  },
]

export default function RecentActivityCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-4">Recent Activity</h2>

      <div className="space-y-4">
        {activities.map((activity) => {
          const ActivityIcon = activity.icon
          return (
            <div
              key={activity.id}
              className="flex gap-4 pb-4 border-b border-border last:border-b-0 last:pb-0"
            >
              <div className="p-2 bg-primary/10 rounded-lg h-fit">
                <ActivityIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">{activity.title}</p>
                <p className="text-xs text-muted-foreground">{activity.description}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Clock className="w-3 h-3" />
                  {activity.time}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button className="w-full mt-4 py-2 text-primary text-sm font-semibold hover:bg-primary/10 rounded-lg transition-colors">
        View All Activity
      </button>
    </div>
  )
}
