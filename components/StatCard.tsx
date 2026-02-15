import { LucideIcon, ArrowUp, ArrowDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  change: string
  icon: LucideIcon
  trend: 'up' | 'down' | 'neutral'
}

export default function StatCard({
  label,
  value,
  change,
  icon: Icon,
  trend,
}: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-muted-foreground'
  const bgColor = trend === 'up' ? 'bg-green-500/10' : trend === 'down' ? 'bg-red-500/10' : 'bg-primary/10'

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {trend !== 'neutral' && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            {trend === 'up' ? (
              <ArrowUp className="w-4 h-4" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
          </div>
        )}
      </div>

      <p className="text-muted-foreground text-sm mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-foreground mb-3">{value}</h3>
      <p className={`text-xs ${trendColor}`}>{change}</p>
    </div>
  )
}
