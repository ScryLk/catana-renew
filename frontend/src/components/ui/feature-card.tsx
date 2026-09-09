import * as React from "react"
import { cn } from "@/lib/utils"

export interface FeatureCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
  variant?: "default" | "highlighted"
}

const FeatureCard = React.forwardRef<HTMLDivElement, FeatureCardProps>(
  ({ className, icon: Icon, title, description, action, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group relative overflow-hidden rounded-2xl p-6 transition-all",
          variant === "default" && "bg-white border border-gray-200 hover:border-primary-300 hover:shadow-medium",
          variant === "highlighted" && "bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-medium hover:shadow-strong",
          className
        )}
        {...props}
      >
        {/* Animated background on hover */}
        <div className={cn(
          "absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100",
          variant === "default" && "bg-gradient-to-br from-primary-50 to-accent-50",
          variant === "highlighted" && "bg-gradient-to-br from-primary-600 to-accent-600"
        )} />

        <div className="relative z-10">
          {Icon && (
            <div className={cn(
              "mb-4 inline-flex rounded-xl p-3 transition-transform group-hover:scale-110",
              variant === "default" && "bg-gradient-to-br from-primary-500 to-accent-500",
              variant === "highlighted" && "bg-white/20 backdrop-blur-sm"
            )}>
              <Icon className={cn(
                "h-6 w-6",
                variant === "default" ? "text-white" : "text-white"
              )} />
            </div>
          )}

          <h3 className={cn(
            "text-lg font-semibold mb-2",
            variant === "default" ? "text-gray-900" : "text-white"
          )}>
            {title}
          </h3>

          <p className={cn(
            "text-sm mb-4",
            variant === "default" ? "text-gray-600" : "text-white/90"
          )}>
            {description}
          </p>

          {action && (
            <div className="mt-4">
              {action}
            </div>
          )}
        </div>
      </div>
    )
  }
)
FeatureCard.displayName = "FeatureCard"

export { FeatureCard }
