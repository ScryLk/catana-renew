import * as React from "react"
import { cn } from "@/lib/utils"

export interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "accent" | "subtle"
}

const GradientCard = React.forwardRef<HTMLDivElement, GradientCardProps>(
  ({ className, variant = "primary", children, ...props }, ref) => {
    const variantStyles = {
      primary: "bg-gradient-to-br from-primary-500 via-primary-600 to-accent-500",
      accent: "bg-gradient-to-br from-accent-400 via-accent-500 to-primary-500",
      subtle: "bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl p-6 shadow-strong transition-all hover:shadow-xl hover:scale-[1.02]",
          variantStyles[variant],
          variant !== "subtle" && "text-white",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
GradientCard.displayName = "GradientCard"

export { GradientCard }
