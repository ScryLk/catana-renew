import * as React from "react"
import { cn } from "@/lib/utils"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    isPositive: boolean
  }
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, description, icon: Icon, trend, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-sm transition-all hover:shadow-md",
          "border border-zinc-200 dark:border-zinc-800",
          className
        )}
        {...props}
      >
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
              {description && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
              )}
            </div>

            {Icon && (
              <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-3 text-zinc-900 dark:text-zinc-100">
                <Icon className="h-5 w-5" />
              </div>
            )}
          </div>

          {trend && (
            <div className="mt-4 flex items-center gap-1">
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}
              >
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">vs last period</span>
            </div>
          )}
        </div>
      </div>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
